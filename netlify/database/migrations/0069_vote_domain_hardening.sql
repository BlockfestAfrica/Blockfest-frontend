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
 * machine-made address test. The last three have no caller yet. They land
 * here so the whole of this change is one migration.
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
 * The body. 0068's exactly, apart from the key, the lock, the held reason
 * and the third output column. auto_blocked is always false for now; it is
 * in the signature so the automatic rule can report through it without
 * changing the shape the verify route reads.
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

    -- The cap. Counted votes from this domain and its subdomains in this
    -- round, allowlisted consumer providers exempt. Held is not a refusal:
    -- the vote is real, verified, and waits for the human the threat model
    -- always ends at.
    --
    -- Votes an owner removed as fraud stay in the tally (0068), so a sweep
    -- never resets a farm to zero. An unsweep is a person freed to vote
    -- again, not a judgement on the domain, so it does not count.
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

  UPDATE votes
     SET verified_at = now(),
         held_at = CASE WHEN held THEN now() ELSE NULL END,
         held_reason = v_reason,
         code_hash = NULL,
         code_expires_at = NULL
   WHERE id = v.id;

  vote_id := v.id;
  RETURN NEXT;
END $$;
