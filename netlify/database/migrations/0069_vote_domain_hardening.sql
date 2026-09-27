/*
 * One domain, one allowance, judged one vote at a time.
 *
 * Two ways past the domain cap survived 0068, and a red team measured both
 * on a throwaway local Postgres.
 *
 * Subdomains. verify_vote, 0068's fraud count, "Remove all as fraud" and
 * the console's clusters all keyed on the full host after the @. A farm
 * with a wildcard MX, or subdomain routing on the same Cloudflare zone, got
 * a fresh allowance of ten on every subdomain for nothing: after eleven
 * oemails.com votes were removed as fraud, ten each from a., b. and
 * c.oemails.com all still counted, thirty counted and none held.
 *
 * Parallel verifies. verify_vote locked only its own vote row and counted
 * the domain's other votes without any lock, so verifies arriving together
 * each saw the count before the others committed. Forty simultaneous
 * verifies against nine counted and a cap of ten ended with twelve to
 * sixteen counted, in twenty trials out of twenty. With a lock taken before
 * the count it was exactly ten every time.
 *
 * So verify_vote takes a seventh argument, the key the domain is judged
 * under: the registrable domain, computed in Node with the public suffix
 * list (lib/vote-domain.ts), because SQL has no list to consult. The cap
 * counts every host that is the key or sits under it, and the count runs
 * under a transaction lock on (round, key), so two verifies from one domain
 * take turns.
 *
 * Matching is by suffix rather than by a stored column, so no backfill is
 * needed: every vote cast before this migration is found by its host the
 * same way as one cast after it.
 *
 * The engine does not take the key on trust. A key that is not the host or
 * a parent of it (a caller bug, or somebody else's domain) falls back to
 * the host, which is exactly the old per-host rule. The worst a wrong key
 * can do is give back the protection 0068 had.
 *
 * The six-argument verify_vote stays, as a wrapper that passes the host as
 * the key. Netlify applies migrations before it publishes the deploy, so
 * the old code calls this schema for a while, and it must keep working
 * (with the lock) until the new code replaces it. The wrapper is defined
 * first and the full body last: the lineage guard keeps the last definition
 * of each name in a file, so the body it compares against 0068's is the one
 * that carries every rule, and every raise from 0068 is kept.
 *
 * held_reason records why a vote was held, so the console can say it and
 * the later rules (a blocked domain, a forwarding service) can release only
 * their own holds. It is kept after a release, as the history of why the
 * vote once waited, the way removed_reason is kept.
 *
 * The small IMMUTABLE helpers are the shared vocabulary of the domain rules:
 * vote_domain_matches is the suffix rule above; vote_domain_protected names
 * school and government domains that no automatic rule may act on;
 * vote_domain_never_block is the consumer providers no block may ever land
 * on, wider than the cap's allowlist; and vote_local_looks_generated is the
 * machine-made address test.
 *
 * Blocked domains, which the owner asked for after the first farm: "Remove
 * all as fraud" used to leave the domain free to try again with fresh
 * addresses, and a farm the owner had already judged could keep casting.
 *
 * - vote_blocked_domains holds one active block per (campaign, domain), under
 *   the registrable domain, so a block covers every subdomain. Blocks are
 *   campaign-wide, and an unblock is soft: the row stays, with who lifted it
 *   and why, and a lifted row is the owner vouching for the domain. A CHECK
 *   keeps every never-block provider out of the table whatever calls it.
 * - verify_vote, under the same lock as the cap, holds any vote from a
 *   blocked domain or a subdomain of one, reason 'blocked', before the cap is
 *   even counted. The voter hears "Your vote is in." exactly as before. The
 *   cast route refuses new casts from a blocked domain before any of this
 *   (lib/vote-domain.ts); this is the backstop for codes already in inboxes
 *   when the block landed, and for the cast route's read failing open.
 * - block_vote_domain blocks, and holds the domain's counted votes in every
 *   round nobody has reviewed yet. Reviewed and published rounds are left
 *   alone: a person certified those tallies.
 * - unblock_vote_domain lifts it and releases what the block (or the
 *   forwarding rule) held in those same rounds, each release audited as one.
 *   Cap holds and fraud removals are untouched: those were judgements about
 *   the allowance of ten, not about the block.
 * - remove_vote_domain replaces "Remove all as fraud"'s single statement. It
 *   removes only the votes that were on the owner's screen, then blocks, in
 *   that order. It had to become a function: sibling CTEs in one statement
 *   run in no defined order, so a block written as a CTE beside the
 *   removals could run first, or not at all.
 *
 * All three take the (round, domain) locks verify_vote takes, every round in
 * one order (opens_at, id), and before they write anything, so a verify
 * arriving mid-block either finishes first and is held by the block, or waits
 * and sees the block.
 *
 * Automatic action, because the incident was over in fourteen minutes and no
 * person was watching:
 *
 * - vote_domain_mx caches what each voting domain's mail host is. Node looks
 *   it up (SQL has no DNS) when a code is cast, inside after() and before the
 *   code is mailed, so the answer is stored before any code can come back to
 *   verify, and the cast's answer and timing never depend on it. Four kinds:
 *   forwarder (a catch-all forwarding service such as Cloudflare Email
 *   Routing, or temp-mail hosting), major (Google, Microsoft, Yahoo, Apple,
 *   Proton), other, and unknown (the lookup failed, which acts on nothing).
 * - verify_vote holds every vote from a forwarder domain from the first one,
 *   reason 'forwarder', unless the domain is a school or government one or
 *   the owner has vouched for it by lifting a block. Quietly: the voter hears
 *   "Your vote is in." and the public count does not move. The farm in the
 *   incident sat behind route1.mx.cloudflare.net, and moving to another
 *   Cloudflare-routed or temp-mail domain now gets it nothing counted.
 * - vote_domain_auto_block, at the end of verify_vote and under the same
 *   lock, blocks the domain at its third verified vote this round when it is
 *   a forwarder, or when it is "other" and at least three verified addresses,
 *   and at least 60% of them, look machine-made. It never acts on a
 *   never-block provider, a school or government domain, or a domain an
 *   owner has ever blocked or unblocked: the owner's decision sticks. It
 *   holds what the domain counted this round and writes an audit row with no
 *   actor, and the verify route mails the owners. The voter's answer is the
 *   same bytes whether it fired or not.
 * - purge_campaign_data clears the mail-host cache as well, since a personal
 *   domain in it is a trace of who voted.
 */

ALTER TABLE votes
  ADD COLUMN held_reason text
  CONSTRAINT vote_held_reason_known
  CHECK (held_reason IN ('cap', 'blocked', 'forwarder'));

/*
 * The host is the key, or sits under it. right() rather than LIKE, so a
 * key can never be read as a pattern: a domain containing an underscore or
 * a percent sign matches only itself.
 */
CREATE OR REPLACE FUNCTION vote_domain_matches(p_host text, p_key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_host = p_key
      OR right(p_host, length(p_key) + 1) = '.' || p_key
$$;

/*
 * School, university and government mail: .edu, .gov and .mil themselves,
 * and the country forms such as .edu.ng, .gov.ng, .ac.uk and .sch.ng.
 * Generated student numbers and initials-plus-surname addresses live here,
 * so no automatic rule acts on these; a person still can.
 */
CREATE OR REPLACE FUNCTION vote_domain_protected(p_domain text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_domain ~ '\.(edu|gov|mil)$'
      OR p_domain ~ '\.(edu|gov|mil|ac|sch)\.[a-z]{2}$'
$$;

/*
 * One inbox, one person, and thousands of real voters: a block on any of
 * these would turn away a crowd to stop one farmer. The nine the cap
 * exempts, plus the Yahoo, Microsoft, Apple, AOL and Proton alias domains
 * that the cap does not exempt but no block may touch.
 */
CREATE OR REPLACE FUNCTION vote_domain_never_block(p_domain text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_domain = ANY (ARRAY[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com',
    'hotmail.com', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com',
    'ymail.com', 'rocketmail.com', 'yahoo.co.uk', 'hotmail.co.uk',
    'live.co.uk', 'msn.com', 'aol.com', 'me.com', 'mac.com', 'pm.me'
  ])
$$;

/*
 * A local part that looks machine-made: letters only, eight or more, and
 * fewer than a quarter of them vowels. Seven of the eight incident
 * addresses pass (hkltkjtzfm does; cuacftsitm does not). Digits and dots
 * never pass, so student numbers and first.last addresses are safe. The
 * whole canonical local part is tested; stripping digits first would make
 * jdoe19 look like a name and 190805123 look like nothing at all.
 *
 * CASE rather than AND, because SQL does not promise to evaluate AND left
 * to right, and the ratio divides by the length.
 */
CREATE OR REPLACE FUNCTION vote_local_looks_generated(p_local text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_local ~ '^[a-z]{8,}$'
      THEN length(regexp_replace(p_local, '[^aeiou]', '', 'g'))::numeric
           / length(p_local) < 0.25
    ELSE false
  END
$$;

/*
 * Domains an owner, or the automatic rule, has blocked.
 *
 * domain is the registrable domain, lowercase: the route normalises what the
 * owner typed with the public suffix list, and the CHECK refuses anything
 * that is not lowercase dotted labels, so a stored block always means "this
 * domain and every subdomain of it" in vote_domain_matches' terms. The CHECK
 * also refuses every never-block provider, so no caller, however it got
 * here, can block gmail.com.
 *
 * evidence is for automatic blocks: counts and the mail host, never a voter's
 * address. created_by_admin_id is null for those.
 *
 * Unblock never deletes. It sets the lifted columns, the row stays as the
 * record, and the partial unique index lets the same domain be blocked again
 * later as a new row.
 */
CREATE TABLE vote_blocked_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES campaigns(id),
  domain              text NOT NULL,
  source              text NOT NULL,
  reason              text NOT NULL,
  evidence            jsonb,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  lifted_at           timestamptz,
  lifted_by_admin_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  lifted_reason       text,
  CONSTRAINT vote_blocked_domain_shape CHECK (
    domain = lower(domain)
    AND domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
    AND NOT vote_domain_never_block(domain)
  ),
  CONSTRAINT vote_blocked_domain_source CHECK (source IN ('admin', 'auto')),
  CONSTRAINT vote_blocked_domain_reason CHECK (btrim(reason) <> ''),
  CONSTRAINT vote_blocked_domain_lift_reason CHECK (
    lifted_at IS NULL OR btrim(COALESCE(lifted_reason, '')) <> ''
  )
);

CREATE UNIQUE INDEX vote_blocked_domains_active
  ON vote_blocked_domains (campaign_id, domain)
  WHERE lifted_at IS NULL;

/*
 * What each voting domain's mail host is, looked up by Node and read here.
 *
 * One row per registrable domain, the key the cap uses. Written when a code
 * is cast (lib/vote-domain.ts, classifyVoteDomain), before the code is
 * mailed, and refreshed after a day, or after five minutes for 'unknown' so
 * a lookup that timed out is soon tried again. primary_mx is the host with
 * the lowest MX preference, the one mail actually goes to; null when the
 * domain has none or the lookup failed.
 *
 * Nothing in it is personal: a domain and its public DNS answer, no address
 * and no vote. The consumer providers, and school and government domains,
 * are never looked up at all.
 */
CREATE TABLE vote_domain_mx (
  domain     text PRIMARY KEY,
  kind       text NOT NULL,
  primary_mx text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vote_domain_mx_kind
    CHECK (kind IN ('forwarder', 'major', 'other', 'unknown'))
);

/*
 * Block a domain on the strength of what it did this round, with no person
 * involved. Called at the end of verify_vote, under the (round, key) lock the
 * vote was judged under, so two verifies from one domain can never both
 * decide to block it, and the hold below sees every vote that committed
 * ahead of this one.
 *
 * It fires on either of two things, both counted over this round's verified
 * votes from the domain and its subdomains, held and fraud-removed ones
 * included so a sweep never resets the evidence:
 *
 * - the domain's mail goes to a forwarding service, and it has three
 *   verified votes; or
 * - its mail host is "other" (not a big mailbox provider, and not unknown),
 *   at least three verified addresses look machine-made, and those are at
 *   least 60% of its verified votes. The share is what spares a real
 *   domain: one with a hundred voters and two initials-plus-surname
 *   addresses that happen to pass the test is nowhere near it.
 *
 * It never acts on a never-block provider, a school or government domain, a
 * key that could not be stored as a block, a domain with no cached mail host
 * (or one that came back unknown, which fails open), or any domain the owner
 * has ever blocked, including one since unblocked: an unblock is the owner
 * saying these are real voters, and a machine does not get to overrule it.
 *
 * On firing it blocks the domain for the campaign, source 'auto', with the
 * evidence as counts and the mail host only (never an address), holds every
 * vote from the domain still counting this round with reason 'blocked', and
 * writes an audit row with no actor. It holds this round only: a round
 * somebody has reviewed was certified by a person, and the rounds after this
 * one have nothing from the domain yet.
 *
 * Returns whether it fired, which verify_vote passes on so the route can mail
 * the owners. Never raises: a domain it cannot block is a domain it leaves
 * to the cap.
 */
CREATE OR REPLACE FUNCTION vote_domain_auto_block(
  p_camp  uuid,
  p_round uuid,
  p_key   text
)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_key      text := lower(btrim(COALESCE(p_key, '')));
  m          vote_domain_mx%ROWTYPE;
  v_verified integer;
  v_machine  integer;
  v_first    timestamptz;
  v_last     timestamptz;
  v_reason   text;
  v_evidence jsonb;
  v_block    uuid;
  v_held     integer;
BEGIN
  /*
   * The table's own CHECK, asked first, so a key it would refuse leaves the
   * vote to the cap instead of failing the verify.
   */
  IF v_key !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
     OR vote_domain_never_block(v_key)
     OR vote_domain_protected(v_key) THEN
    RETURN false;
  END IF;

  -- Blocked now, or blocked once and lifted: either way a person decided.
  IF EXISTS (
    SELECT 1
      FROM vote_blocked_domains b
     WHERE b.campaign_id = p_camp
       AND vote_domain_matches(v_key, b.domain)
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO m FROM vote_domain_mx WHERE domain = v_key;
  IF m.domain IS NULL OR m.kind NOT IN ('forwarder', 'other') THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (
           WHERE vote_local_looks_generated(split_part(v.voter_email_canonical, '@', 1))
         )::integer,
         min(v.verified_at),
         max(v.verified_at)
    INTO v_verified, v_machine, v_first, v_last
    FROM votes v
   WHERE v.round_id = p_round
     AND v.verified_at IS NOT NULL
     AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), v_key)
     AND (v.status = 'counted'
          OR (v.status = 'removed' AND v.removed_mode = 'fraud'));

  IF m.kind = 'forwarder' AND v_verified >= 3 THEN
    v_reason := format(
      'Forwarding service (%s), %s verified votes this round',
      COALESCE(m.primary_mx, 'unknown host'), v_verified
    );
  ELSIF m.kind = 'other' AND v_machine >= 3 AND v_machine * 5 >= v_verified * 3 THEN
    v_reason := format(
      '%s of %s verified addresses look machine-made', v_machine, v_verified
    );
  ELSE
    RETURN false;
  END IF;

  v_evidence := jsonb_build_object(
    'round_id', p_round,
    'kind', m.kind,
    'primary_mx', m.primary_mx,
    'verified', v_verified,
    'machine_made', v_machine,
    'first_at', v_first,
    'last_at', v_last
  );

  /*
   * No conflict is possible from an owner's block: block_vote_domain takes
   * this round's lock before it inserts, and the lock is held here. One can
   * only come from a verify in another round auto-blocking the same domain
   * at this moment; that one blocked it, so this one did not.
   */
  INSERT INTO vote_blocked_domains (campaign_id, domain, source, reason, evidence)
  VALUES (p_camp, v_key, 'auto', v_reason, v_evidence)
  ON CONFLICT (campaign_id, domain) WHERE lifted_at IS NULL DO NOTHING
  RETURNING id INTO v_block;
  IF v_block IS NULL THEN
    RETURN false;
  END IF;

  UPDATE votes v
     SET held_at = now(),
         held_reason = 'blocked'
   WHERE v.round_id = p_round
     AND v.status = 'counted'
     AND v.verified_at IS NOT NULL
     AND v.held_at IS NULL
     AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), v_key);
  GET DIAGNOSTICS v_held = ROW_COUNT;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (p_camp, NULL, 'vote_domain.auto_blocked', 'vote_domain', v_block,
          v_evidence || jsonb_build_object('domain', v_key, 'held', v_held),
          v_reason);

  RETURN true;
END $$;

/*
 * The old signature, for the old code. It judges the vote under its own
 * host, which is what the old code meant, and gains the lock and the held
 * reason from the body below.
 */
CREATE OR REPLACE FUNCTION verify_vote(
  p_campaign_slug   text,
  p_round           uuid,
  p_email_canonical text,
  p_code_hash       text,
  p_domain_cap      integer,
  p_domain_allowlisted boolean
)
RETURNS TABLE (vote_id uuid, held boolean)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT f.vote_id, f.held
      FROM verify_vote(
             p_campaign_slug, p_round, p_email_canonical, p_code_hash,
             p_domain_cap, p_domain_allowlisted,
             split_part(p_email_canonical, '@', 2)
           ) AS f;
END $$;

/*
 * The body. 0068's exactly, apart from the key, the lock, the held reason,
 * the blocked-domain and forwarder holds, the automatic block and the third
 * output column. auto_blocked is true on the one verify whose vote made the
 * domain blocked automatically, so the route can tell the owners; it never
 * reaches the voter.
 */
CREATE OR REPLACE FUNCTION verify_vote(
  p_campaign_slug   text,
  p_round           uuid,
  p_email_canonical text,
  p_code_hash       text,
  p_domain_cap      integer,
  p_domain_allowlisted boolean,
  p_domain_key      text
)
RETURNS TABLE (vote_id uuid, held boolean, auto_blocked boolean)
LANGUAGE plpgsql AS $$
DECLARE
  r        vote_rounds%ROWTYPE;
  v_camp   uuid;
  v        votes%ROWTYPE;
  v_host   text;
  v_key    text;
  v_used   integer;
  v_reason text;
BEGIN
  SELECT id INTO v_camp FROM campaigns WHERE slug = p_campaign_slug;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round AND campaign_id = v_camp;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF now() > r.closes_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;
  /*
   * And the state, not only the clock. A reviewed round has been certified
   * by a human; a published one has paid. Neither may gain a vote, however
   * live the code in somebody's inbox still looks.
   */
  IF r.reviewed_at IS NOT NULL OR r.status = 'published' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;

  SELECT * INTO v FROM votes
   WHERE round_id = p_round AND voter_email_canonical = p_email_canonical
     AND status = 'counted' AND verified_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = 'P0817';
  END IF;
  IF v.code_hash IS DISTINCT FROM p_code_hash OR now() > v.code_expires_at THEN
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = 'P0817';
  END IF;

  held := false;
  auto_blocked := false;
  IF NOT COALESCE(p_domain_allowlisted, false) THEN
    /*
     * The key the caller computed, if it is this vote's host or a parent
     * of it with a dot in it. Anything else, including nothing, falls back
     * to the host: a bare "com" would pool every .com voter into one
     * allowance, and a stranger's domain would spend theirs.
     */
    v_host := split_part(p_email_canonical, '@', 2);
    v_key := p_domain_key;
    IF v_key IS NULL
       OR strpos(v_key, '.') = 0
       OR NOT vote_domain_matches(v_host, v_key) THEN
      v_key := v_host;
    END IF;

    /*
     * One verify per (round, key) at a time, held to the end of this
     * transaction. It comes after this vote's own row lock and code check,
     * so a wrong code never waits, and before the tally below, so the tally
     * sees every vote from the domain that committed ahead of this one.
     * Allowlisted providers never reach it, so a gmail.com rally never
     * queues behind itself.
     */
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vote-domain:' || p_round::text || ':' || v_key, 0)
    );

    /*
     * A blocked domain first, and on the host rather than the key: a block
     * covers every subdomain of the blocked domain whatever key the caller
     * sent, including the host the old six-argument call sends. The code in
     * this inbox was mailed before the block landed (the cast route refuses
     * new casts from a blocked domain), so the voter hears the same "Your
     * vote is in." as anybody, and the vote waits for the owner who blocked
     * it. Under the lock, so a block_vote_domain running now has either
     * committed (and is seen here) or is waiting for this vote to commit
     * (and holds it itself).
     */
    IF EXISTS (
      SELECT 1
        FROM vote_blocked_domains b
       WHERE b.campaign_id = v_camp
         AND b.lifted_at IS NULL
         AND vote_domain_matches(v_host, b.domain)
    ) THEN
      held := true;
      v_reason := 'blocked';
    /*
     * Then a forwarding service, from the first vote. Its mail goes to a
     * catch-all forwarder, which is how one person runs unlimited inboxes on
     * a domain, so none of its votes counts until a person has looked; the
     * voter hears the same "Your vote is in." and the public count does not
     * move. Not for a school or government domain, which no automatic rule
     * touches, and not once the owner has lifted a block on it: that is the
     * owner vouching for the domain's voters. The key's cached kind is read,
     * never looked up here; no row, or unknown, holds nothing.
     */
    ELSIF EXISTS (
            SELECT 1
              FROM vote_domain_mx m
             WHERE m.domain = v_key
               AND m.kind = 'forwarder'
          )
          AND NOT vote_domain_protected(v_key)
          AND NOT vote_domain_never_block(v_key)
          AND NOT EXISTS (
            SELECT 1
              FROM vote_blocked_domains b
             WHERE b.campaign_id = v_camp
               AND b.lifted_at IS NOT NULL
               AND vote_domain_matches(v_host, b.domain)
          ) THEN
      held := true;
      v_reason := 'forwarder';
    ELSE
      -- The cap. Counted votes from this domain and its subdomains in this
      -- round, allowlisted consumer providers exempt. Held is not a
      -- refusal: the vote is real, verified, and waits for the human the
      -- threat model always ends at.
      --
      -- Votes an owner removed as fraud stay in the tally (0068), so a
      -- sweep never resets a farm to zero. An unsweep is a person freed to
      -- vote again, not a judgement on the domain, so it does not count.
      SELECT count(*) INTO v_used
        FROM votes v2
       WHERE v2.round_id = p_round
         AND vote_domain_matches(split_part(v2.voter_email_canonical, '@', 2), v_key)
         AND (
               (v2.status = 'counted'
                AND v2.verified_at IS NOT NULL
                AND v2.held_at IS NULL)
            OR (v2.status = 'removed' AND v2.removed_mode = 'fraud')
             );
      IF v_used >= COALESCE(p_domain_cap, 10) THEN
        held := true;
        v_reason := 'cap';
      END IF;
    END IF;
  END IF;

  UPDATE votes
     SET verified_at = now(),
         held_at = CASE WHEN held THEN now() ELSE NULL END,
         held_reason = v_reason,
         code_hash = NULL,
         code_expires_at = NULL
   WHERE id = v.id;

  /*
   * Last, with this vote already verified so it is part of the evidence, and
   * still under the lock. If the domain is blocked now, this vote was held
   * with the rest of the round's, and the verify route tells the owners. The
   * voter is told nothing different.
   */
  IF NOT COALESCE(p_domain_allowlisted, false) THEN
    auto_blocked := vote_domain_auto_block(v_camp, p_round, v_key);
    IF auto_blocked THEN
      held := true;
    END IF;
  END IF;

  vote_id := v.id;
  RETURN NEXT;
END $$;

/*
 * Block a domain for the rest of the campaign, and hold what it has counted
 * in every round nobody has reviewed yet.
 *
 * The domain arrives normalised to its registrable form by the route, and
 * the table's CHECK refuses a malformed one; a never-block provider is
 * refused here first, by name, so the console can say why instead of
 * showing a constraint error.
 *
 * Blocking a domain that is already blocked is not an error, because "Remove
 * all as fraud" blocks after it removes and the domain may be blocked
 * already. It changes nothing and holds nothing: every vote verified since
 * the first block was held by verify_vote, so the only counted votes left
 * are ones an owner released on purpose, and a second press must not take
 * that decision back.
 *
 * The holds are reversible and each is the same act release_vote undoes. A
 * reviewed or published round is left alone: its tally was certified by a
 * person, and no block may move it after that.
 */
CREATE OR REPLACE FUNCTION block_vote_domain(
  p_admin    uuid,
  p_campaign uuid,
  p_domain   text,
  p_reason   text
)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_domain text := lower(btrim(COALESCE(p_domain, '')));
  v_block  uuid;
  v_rounds uuid[];
  v_round  uuid;
  v_n      integer;
  v_held   integer := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;
  IF vote_domain_never_block(v_domain) THEN
    RAISE EXCEPTION 'domain_not_blockable' USING ERRCODE = 'P0822';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM campaigns WHERE id = p_campaign) THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  /*
   * The locks before the row, every round's in one order. A verify that got
   * a round's lock first finishes (and may block the domain automatically
   * while it holds it), then this sees its vote; one that asks after this
   * transaction commits sees the block and holds its own vote.
   *
   * Row first and locks second would deadlock against the automatic rule:
   * this transaction holding the new row and waiting for a round's lock,
   * while the verify holding that lock waits to insert the same (campaign,
   * domain) row.
   */
  v_rounds := ARRAY(
    SELECT r.id
      FROM vote_rounds r
     WHERE r.campaign_id = p_campaign
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
  );
  FOREACH v_round IN ARRAY v_rounds LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vote-domain:' || v_round::text || ':' || v_domain, 0)
    );
  END LOOP;

  INSERT INTO vote_blocked_domains
         (campaign_id, domain, source, reason, created_by_admin_id)
  VALUES (p_campaign, v_domain, 'admin', btrim(p_reason), p_admin)
  ON CONFLICT (campaign_id, domain) WHERE lifted_at IS NULL DO NOTHING
  RETURNING id INTO v_block;

  IF v_block IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_round IN ARRAY v_rounds LOOP
    UPDATE votes v
       SET held_at = now(),
           held_reason = 'blocked'
     WHERE v.round_id = v_round
       AND v.status = 'counted'
       AND v.verified_at IS NOT NULL
       AND v.held_at IS NULL
       AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), v_domain);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_held := v_held + v_n;
  END LOOP;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (p_campaign, p_admin, 'vote_domain.blocked', 'vote_domain', v_block,
          jsonb_build_object('domain', v_domain, 'held', v_held),
          btrim(p_reason));

  RETURN v_held;
END $$;

/*
 * Lift a block, and release what it held.
 *
 * The row is kept, with who lifted it and why, and from then on it is the
 * owner vouching for the domain: the automatic rule will not act on a
 * domain that has a lifted row.
 *
 * Released: votes held for the block ('blocked') or by the forwarding rule
 * ('forwarder') in rounds nobody has reviewed, each through release_vote so
 * each release is audited as one, unless another active block still covers
 * the vote's host. Not released: cap holds, which were a judgement about the
 * allowance of ten and not about the block; fraud removals, which cannot be
 * undone and still use up that allowance; and anything in a reviewed or
 * published round.
 */
CREATE OR REPLACE FUNCTION unblock_vote_domain(
  p_admin    uuid,
  p_campaign uuid,
  p_domain   text,
  p_reason   text
)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_domain   text := lower(btrim(COALESCE(p_domain, '')));
  v_block    uuid;
  v_round    uuid;
  v_vote     uuid;
  v_released integer := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  UPDATE vote_blocked_domains
     SET lifted_at = now(),
         lifted_by_admin_id = p_admin,
         lifted_reason = btrim(p_reason)
   WHERE campaign_id = p_campaign
     AND domain = v_domain
     AND lifted_at IS NULL
  RETURNING id INTO v_block;
  IF v_block IS NULL THEN
    RAISE EXCEPTION 'domain_not_blocked' USING ERRCODE = 'P0823';
  END IF;

  FOR v_round IN
    SELECT r.id
      FROM vote_rounds r
     WHERE r.campaign_id = p_campaign
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vote-domain:' || v_round::text || ':' || v_domain, 0)
    );
    FOR v_vote IN
      SELECT v.id
        FROM votes v
       WHERE v.round_id = v_round
         AND v.status = 'counted'
         AND v.held_at IS NOT NULL
         AND v.held_reason IN ('blocked', 'forwarder')
         AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), v_domain)
         AND NOT EXISTS (
               SELECT 1
                 FROM vote_blocked_domains b
                WHERE b.campaign_id = p_campaign
                  AND b.lifted_at IS NULL
                  AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), b.domain)
             )
       ORDER BY v.created_at, v.id
    LOOP
      PERFORM release_vote(p_admin, v_vote);
      v_released := v_released + 1;
    END LOOP;
  END LOOP;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (p_campaign, p_admin, 'vote_domain.unblocked', 'vote_domain', v_block,
          jsonb_build_object('domain', v_domain, 'released', v_released),
          btrim(p_reason));

  RETURN v_released;
END $$;

/*
 * "Remove all as fraud", as one act: remove the votes the owner was looking
 * at, then block the domain.
 *
 * Only the listed ids. The console sends the votes that were on screen when
 * the owner judged the cluster, and a vote that arrived after the page loaded
 * is not removed on the strength of a judgement nobody made about it; the
 * block holds it instead, which a person can still release. Each listed id
 * must still be a counted, verified vote in this round from this domain or a
 * subdomain of it, or it is skipped.
 *
 * A never-block provider is refused before anything is touched, and the
 * whole function is one transaction, so a refusal from the block at the end
 * undoes the removals with it. A published round is refused: its winner was
 * announced on this tally. A reviewed one is not, because a removal between
 * the review and the announce is the last chance to take a farmed vote out
 * of the tally that picks the winner (the console keeps the control there
 * for that reason).
 *
 * The locks come first, for every round the block will touch as well as this
 * one, in the one order block_vote_domain uses, so two owners acting on one
 * domain at once queue instead of deadlocking. The targets are locked in a
 * fixed order for the same reason.
 */
CREATE OR REPLACE FUNCTION remove_vote_domain(
  p_admin    uuid,
  p_round    uuid,
  p_domain   text,
  p_reason   text,
  p_vote_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_domain  text := lower(btrim(COALESCE(p_domain, '')));
  r         vote_rounds%ROWTYPE;
  v_lock    uuid;
  v_vote    uuid;
  v_removed integer := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;
  IF vote_domain_never_block(v_domain) THEN
    RAISE EXCEPTION 'domain_not_blockable' USING ERRCODE = 'P0822';
  END IF;

  SELECT * INTO r FROM vote_rounds WHERE id = p_round;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status = 'published' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;

  FOR v_lock IN
    SELECT x.id
      FROM vote_rounds x
     WHERE x.campaign_id = r.campaign_id
       AND (x.id = p_round OR (x.reviewed_at IS NULL AND x.status <> 'published'))
     ORDER BY x.opens_at, x.id
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vote-domain:' || v_lock::text || ':' || v_domain, 0)
    );
  END LOOP;

  FOR v_vote IN
    SELECT v.id
      FROM votes v
     WHERE v.id = ANY (p_vote_ids)
       AND v.round_id = p_round
       AND v.status = 'counted'
       AND v.verified_at IS NOT NULL
       AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), v_domain)
     ORDER BY v.created_at, v.id
     FOR UPDATE
  LOOP
    PERFORM remove_vote(p_admin, v_vote, p_reason, 'fraud');
    v_removed := v_removed + 1;
  END LOOP;

  PERFORM block_vote_domain(p_admin, r.campaign_id, v_domain, p_reason);

  RETURN v_removed;
END $$;

/*
 * The purge learns the mail-host cache. Regenerated from 0036, its latest
 * definition, with one DELETE and its own count added: the cache holds the
 * domains voters used, and some of those are personal domains, so "kept"
 * was not an option.
 */
CREATE OR REPLACE FUNCTION purge_campaign_data(p_slug text, p_confirm text)
RETURNS TABLE (table_name text, rows_deleted integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  n          integer;
BEGIN
  IF p_confirm IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION
      'confirm by passing the slug twice: SELECT * FROM purge_campaign_data(%L, %L);', p_slug, p_slug
      USING ERRCODE = 'P0601';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'no campaign with slug %', p_slug USING ERRCODE = 'P0602';
  END IF;

  DELETE FROM votes v USING vote_rounds r
   WHERE v.round_id = r.id AND r.campaign_id = v_campaign;

  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'votes'; rows_deleted := n; RETURN NEXT;

  /*
   * The rate limit counters.
   *
   * Not campaign scoped, because a bucket is a client address and a limit name,
   * and neither knows which campaign the request was for. Cleared wholesale
   * anyway: the bucket is derived from an IP address, an IP address is personal
   * data, and "purge everything about this campaign" that leaves personal data
   * behind is not a purge. The cost of clearing it is that everybody's budget
   * resets, which lasts one window and matters to nobody.
   *
   * The table also expires its own rows after a day, so this is the floor
   * rather than the only cleanup.
   */
  DELETE FROM request_throttle;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'request_throttle'; rows_deleted := n; RETURN NEXT;

  /*
   * The mail-host cache (0069). Not campaign scoped either, and cleared
   * wholesale for the same reason as the throttle: a row is a domain somebody
   * voted from, and a personal domain names its owner as well as an address
   * would, so a purge that kept it would keep a trace of who voted. The cost
   * is one fresh lookup per domain the next time it votes.
   */
  DELETE FROM vote_domain_mx;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_domain_mx'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_round_nominees vn USING vote_rounds r
   WHERE vn.round_id = r.id AND r.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_round_nominees'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_rounds WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_rounds'; rows_deleted := n; RETURN NEXT;

  -- Before weekly_winners, which it references by entry and by creator.
  n := purge_snapshots(v_campaign);
  table_name := 'leaderboard_snapshots'; rows_deleted := n; RETURN NEXT;

  DELETE FROM weekly_winners WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'weekly_winners'; rows_deleted := n; RETURN NEXT;

  DELETE FROM referrals WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'referrals'; rows_deleted := n; RETURN NEXT;

  DELETE FROM point_ledger WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'point_ledger'; rows_deleted := n; RETURN NEXT;

  DELETE FROM submissions s USING challenge_entries ce, campaign_creators cc
   WHERE s.entry_id = ce.id AND ce.campaign_creator_id = cc.id
     AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'submissions'; rows_deleted := n; RETURN NEXT;

  DELETE FROM handle_change_requests r USING campaign_creators cc
   WHERE r.campaign_creator_id = cc.id AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'handle_change_requests'; rows_deleted := n; RETURN NEXT;

  DELETE FROM challenge_entries ce USING campaign_creators cc
   WHERE ce.campaign_creator_id = cc.id AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'challenge_entries'; rows_deleted := n; RETURN NEXT;

  DELETE FROM creator_social_handles csh
   WHERE csh.creator_id IN (
     SELECT cc.creator_id FROM campaign_creators cc WHERE cc.campaign_id = v_campaign
   )
   AND NOT EXISTS (
     SELECT 1 FROM campaign_creators other
      WHERE other.creator_id = csh.creator_id AND other.campaign_id <> v_campaign
   );
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'creator_social_handles'; rows_deleted := n; RETURN NEXT;

  CREATE TEMP TABLE purge_orphans ON COMMIT DROP AS
    SELECT cc.creator_id FROM campaign_creators cc
     WHERE cc.campaign_id = v_campaign
       AND NOT EXISTS (
         SELECT 1 FROM campaign_creators other
          WHERE other.creator_id = cc.creator_id AND other.campaign_id <> v_campaign
       );

  DELETE FROM campaign_creators WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'campaign_creators'; rows_deleted := n; RETURN NEXT;

  DELETE FROM creators WHERE id IN (SELECT creator_id FROM purge_orphans);
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'creators'; rows_deleted := n; RETURN NEXT;

  DELETE FROM registration_attempts;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'registration_attempts'; rows_deleted := n; RETURN NEXT;

  DELETE FROM audit_log WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  INSERT INTO audit_log (campaign_id, action, entity_type, entity_id, note)
  VALUES (v_campaign, 'campaign.purged', 'campaign', v_campaign,
          'Test data cleared from the database console before launch.');
END $$;

