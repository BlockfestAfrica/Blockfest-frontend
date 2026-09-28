/*
 * Owners acting on one domain queue instead of deadlocking, and an unblock
 * keeps the domain's allowance of ten.
 *
 * These are the review fixes to 0069, in their own file because 0069 had
 * already been applied to PR #273's preview database when they were
 * written; a migration changed after it is applied is refused, and editing
 * 0069 in place failed that preview's deploy. Production has applied
 * neither, and runs 0069 then this.
 *
 *   unblock_vote_domain took the block's row before the per-round advisory
 *   locks, the reverse of block_vote_domain and remove_vote_domain, so an
 *   Unblock and a Block (or Remove all) on one domain at the same moment
 *   deadlocked: 48 of 50 trials on a local Postgres 15, 0 after. It now
 *   holds the rounds FOR SHARE, takes every round's lock in the same order
 *   as Block, and only then touches the row; it skips a vote another owner
 *   released meanwhile instead of failing on it; and it releases the
 *   block's holds only while the domain is under its allowance in that
 *   round (p_domain_cap, oldest first), re-marking the rest 'cap'. The old
 *   four-argument signature is dropped so it cannot be called.
 *
 *   block_vote_domain and remove_vote_domain hold the rounds they will
 *   touch FOR SHARE before their locks and read them again after, so a
 *   review that commits in between cannot have its tally moved.
 *   block_vote_domain returns NULL when the domain was already blocked, so
 *   the console can say so instead of "blocked, held 0".
 *
 *   verify_vote reads its round again after the domain lock and refuses
 *   (P0814) if the round was reviewed or published while it waited.
 *
 * Every RAISE of the 0069 definitions is kept; the lineage guard checks it.
 */

DROP FUNCTION IF EXISTS unblock_vote_domain(uuid, uuid, text, text);

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
     * The round's state again, now that this holds the lock. The check at
     * the top ran before any wait, and a Block, Unblock or Remove all on
     * this domain can hold the lock for a while; a review or an announce
     * that committed meanwhile must still turn this vote away, exactly as
     * it would have at the top.
     */
    SELECT * INTO r FROM vote_rounds WHERE id = p_round;
    IF r.reviewed_at IS NOT NULL OR r.status = 'published' THEN
      RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
    END IF;

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
   * The rounds first, held FOR SHARE in one order, so none of them can be
   * marked reviewed (mark_round_reviewed takes FOR UPDATE) or published
   * while this waits on the locks below and holds its votes. Without it a
   * review could commit in that wait, and the holds would land in a tally a
   * person had already certified. Then the set again, after the row locks:
   * a round reviewed while this waited for its row is not one to touch.
   */
  v_rounds := ARRAY(
    SELECT r.id
      FROM vote_rounds r
     WHERE r.campaign_id = p_campaign
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
       FOR SHARE
  );
  v_rounds := ARRAY(
    SELECT r.id
      FROM vote_rounds r
     WHERE r.id = ANY (v_rounds)
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
  );

  /*
   * The locks before the row, every round's in one order. A verify that got
   * a round's lock first finishes (and may block the domain automatically
   * while it holds it), then this sees its vote; one that asks after this
   * transaction commits sees the block and holds its own vote.
   *
   * Row first and locks second would deadlock against the automatic rule:
   * this transaction holding the new row and waiting for a round's lock,
   * while the verify holding that lock waits to insert the same (campaign,
   * domain) row. unblock_vote_domain takes the same locks in the same order
   * before it touches the row, for the same reason.
   */
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

  -- Already blocked: nothing inserted, nothing held, and null says so.
  IF v_block IS NULL THEN
    RETURN NULL;
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

CREATE OR REPLACE FUNCTION unblock_vote_domain(
  p_admin      uuid,
  p_campaign   uuid,
  p_domain     text,
  p_reason     text,
  p_domain_cap integer DEFAULT 10
)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_domain   text := lower(btrim(COALESCE(p_domain, '')));
  v_cap      integer := COALESCE(p_domain_cap, 10);
  v_block    uuid;
  v_rounds   uuid[];
  v_round    uuid;
  v_votes    uuid[];
  v_vote     uuid;
  v_used     integer;
  v_released integer := 0;
  v_capped   integer := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  -- The rounds, held so none is reviewed or published under this, and the
  -- set read again once they are held.
  v_rounds := ARRAY(
    SELECT r.id
      FROM vote_rounds r
     WHERE r.campaign_id = p_campaign
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
       FOR SHARE
  );
  v_rounds := ARRAY(
    SELECT r.id
      FROM vote_rounds r
     WHERE r.id = ANY (v_rounds)
       AND r.reviewed_at IS NULL
       AND r.status <> 'published'
     ORDER BY r.opens_at, r.id
  );

  -- Every round's lock before the row, the key and order block_vote_domain uses.
  FOREACH v_round IN ARRAY v_rounds LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vote-domain:' || v_round::text || ':' || v_domain, 0)
    );
  END LOOP;

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

  FOREACH v_round IN ARRAY v_rounds LOOP
    /*
     * The candidates, locked. A row another owner released while this
     * waited is read again when its lock is granted, no longer matches
     * held_at IS NOT NULL, and drops out here.
     */
    v_votes := ARRAY(
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
         FOR UPDATE OF v
    );

    -- What the domain has used of its ten this round, as verify_vote counts it.
    SELECT count(*) INTO v_used
      FROM votes v2
     WHERE v2.round_id = v_round
       AND vote_domain_matches(split_part(v2.voter_email_canonical, '@', 2), v_domain)
       AND (
             (v2.status = 'counted'
              AND v2.verified_at IS NOT NULL
              AND v2.held_at IS NULL)
          OR (v2.status = 'removed' AND v2.removed_mode = 'fraud')
           );

    FOREACH v_vote IN ARRAY v_votes LOOP
      IF v_used < v_cap THEN
        PERFORM release_vote(p_admin, v_vote);
        v_used := v_used + 1;
        v_released := v_released + 1;
      ELSE
        UPDATE votes SET held_reason = 'cap' WHERE id = v_vote;
        v_capped := v_capped + 1;
      END IF;
    END LOOP;
  END LOOP;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (p_campaign, p_admin, 'vote_domain.unblocked', 'vote_domain', v_block,
          jsonb_build_object('domain', v_domain, 'released', v_released, 'over_cap', v_capped),
          btrim(p_reason));

  RETURN v_released;
END $$;

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
  v_rounds  uuid[];
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

  /*
   * The rounds it touches, held FOR SHARE in the one order before any lock
   * is waited on, so none is published, and none the block will hold in is
   * reviewed, while this waits. Then read again once held: this round may
   * have been published, or another reviewed, while this waited for its row.
   */
  v_rounds := ARRAY(
    SELECT x.id
      FROM vote_rounds x
     WHERE x.campaign_id = r.campaign_id
       AND (x.id = p_round OR (x.reviewed_at IS NULL AND x.status <> 'published'))
     ORDER BY x.opens_at, x.id
       FOR SHARE
  );
  SELECT * INTO r FROM vote_rounds WHERE id = p_round;
  IF r.status = 'published' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;
  v_rounds := ARRAY(
    SELECT x.id
      FROM vote_rounds x
     WHERE x.id = ANY (v_rounds)
       AND (x.id = p_round OR (x.reviewed_at IS NULL AND x.status <> 'published'))
     ORDER BY x.opens_at, x.id
  );

  FOREACH v_lock IN ARRAY v_rounds LOOP
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
