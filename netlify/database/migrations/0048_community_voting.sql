-- Community Favourite voting, the engine.
--
-- Numbered 0048: written as 0046, renumbered before ever applying so it
-- sorts after 0047, the renamed submission-hardening migration that
-- unblocked the deploy pipeline.
--
-- The tables have existed since 0000 with the hard rules in their
-- constraints: one COUNTED vote per canonical email per round, nomination
-- at entry level, removal that keeps the row. This adds what votes:
-- lifecycle, casting, email-code verification, the domain cap, removal
-- modes, the review gate, and the single canonical definition of a
-- countable vote. Design and threat model are in the scope document the
-- team approved; the short version of each decision is beside its code.

-- ---------------------------------------------------------------------------
-- A held vote: verified, but parked for a person to look at.
--
-- The catch-all-domain attack makes "one inbox, one vote" purchasable in
-- bulk, so verified votes past a per-domain cap wait for review instead of
-- counting silently. A timestamp, deliberately not a new enum value: a
-- value added to vote_status could not be used in the same migration that
-- adds it, and a held vote IS still a counted, verified vote — just one a
-- person has not admitted to the tally yet. Clearing held_at admits it.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS held_at timestamptz;

-- The verification code, hashed like every other secret here, bound to the
-- CAST: recasting regenerates it, so an old code can never verify a choice
-- the voter has since changed.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS code_hash text;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS code_expires_at timestamptz;

-- How a removal was meant: 'fraud' bars the email for the round, 'unsweep'
-- frees a wrongly-flagged person to vote again. Without the split, a farm
-- re-casts faster than a human can remove.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS removed_mode text
  CHECK (removed_mode IN ('fraud', 'unsweep'));

-- A withdrawn nominee leaves the ballot without taking the audit trail of
-- their votes with them; deleting the row would cascade-delete the votes.
ALTER TABLE vote_round_nominees ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
ALTER TABLE vote_round_nominees ADD COLUMN IF NOT EXISTS withdrawn_by_admin_id uuid
  REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE vote_round_nominees ADD COLUMN IF NOT EXISTS withdrawn_reason text;

-- Announcing requires the suspicious-vote sweep to have happened; this is
-- the timestamp that says it did.
ALTER TABLE vote_rounds ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE vote_rounds ADD COLUMN IF NOT EXISTS reviewed_by_admin_id uuid
  REFERENCES admin_users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- THE canonical countable vote. Every tally, count and winner selection
-- reads this view and nothing else: an unverified vote needs no inbox at
-- all, so any query that forgets the verified_at predicate is an open
-- door, and a view nobody can forget is the fix.
CREATE OR REPLACE VIEW countable_votes AS
  SELECT v.*
    FROM votes v
    JOIN vote_round_nominees n ON n.id = v.nominee_id
   WHERE v.status = 'counted'
     AND v.verified_at IS NOT NULL
     AND v.held_at IS NULL
     AND n.withdrawn_at IS NULL;

CREATE OR REPLACE VIEW vote_tally AS
  SELECT n.round_id, n.id AS nominee_id, n.entry_id,
         count(cv.id)::integer AS votes
    FROM vote_round_nominees n
    LEFT JOIN countable_votes cv ON cv.nominee_id = n.id
   WHERE n.withdrawn_at IS NULL
   GROUP BY n.round_id, n.id, n.entry_id;

-- ---------------------------------------------------------------------------
-- Opening a round: shortlist and window in one audited act.
--
-- Three to five approved entries of that week's challenge. Fewer than
-- three needs p_allow_few plus a recorded reason, the tired-Sunday
-- override made deliberate. The one-round-per-week index does the rest.
CREATE OR REPLACE FUNCTION open_vote_round(
  p_campaign_slug text,
  p_week_no       smallint,
  p_opens_at      timestamptz,
  p_closes_at     timestamptz,
  p_entry_ids     uuid[],
  p_admin         uuid,
  p_allow_few     boolean DEFAULT false,
  p_few_reason    text DEFAULT NULL
)
RETURNS TABLE (round_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_round    uuid;
  v_entry    uuid;
  v_n        integer;
  v_ok       integer;
  v_order    smallint := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug FOR UPDATE;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_closes_at <= p_opens_at THEN
    RAISE EXCEPTION 'window_inverted' USING ERRCODE = 'P0908';
  END IF;

  v_n := COALESCE(array_length(p_entry_ids, 1), 0);
  IF v_n > 5 THEN
    RAISE EXCEPTION 'too_many_nominees' USING ERRCODE = 'P0810';
  END IF;
  IF v_n < 3 AND NOT (COALESCE(p_allow_few, false) AND p_few_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'too_few_nominees' USING ERRCODE = 'P0811';
  END IF;

  -- Every nominee must be an approved entry of THIS week's challenge in
  -- THIS campaign. A stale screen or a pasted id from another week fails
  -- here by name rather than seating a wrong ballot.
  SELECT count(*) INTO v_ok
    FROM challenge_entries e
    JOIN challenges ch ON ch.id = e.challenge_id
   WHERE e.id = ANY(p_entry_ids)
     AND ch.campaign_id = v_campaign
     AND ch.week_no = p_week_no
     AND e.approved_platform_count >= 1;
  IF v_ok <> v_n THEN
    RAISE EXCEPTION 'nominee_not_eligible' USING ERRCODE = 'P0812';
  END IF;

  INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
  VALUES (v_campaign, p_week_no, 'open', p_opens_at, p_closes_at)
  RETURNING id INTO v_round;

  FOREACH v_entry IN ARRAY p_entry_ids LOOP
    INSERT INTO vote_round_nominees (round_id, entry_id, display_order)
    VALUES (v_round, v_entry, v_order);
    v_order := v_order + 1;
  END LOOP;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (
    v_campaign, p_admin, 'vote_round.opened', 'vote_round', v_round,
    jsonb_build_object('week_no', p_week_no, 'nominees', v_n,
                       'opens_at', p_opens_at, 'closes_at', p_closes_at),
    p_few_reason
  );

  round_id := v_round;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Casting. The voter's side of one counted vote per email per round.
--
-- Refusals are by name so the route can answer honestly without leaking
-- mechanics. A pending (unverified) vote is replaced by a new cast, which
-- regenerates the code and invalidates the old one; a verified vote, a
-- held vote, or a fraud-removed email refuses. The domain cap is judged at
-- verify time, where a vote becomes countable.
CREATE OR REPLACE FUNCTION cast_vote(
  p_campaign_slug   text,
  p_round           uuid,
  p_nominee         uuid,
  p_email_canonical text,
  p_code_hash       text,
  p_ip_hash         text,
  p_user_agent      text
)
RETURNS TABLE (vote_id uuid, replaced boolean)
LANGUAGE plpgsql AS $$
DECLARE
  r        vote_rounds%ROWTYPE;
  v_camp   uuid;
  v_id     uuid;
  v_status vote_status;
  v_mode   text;
BEGIN
  SELECT id INTO v_camp FROM campaigns WHERE slug = p_campaign_slug;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round AND campaign_id = v_camp;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status <> 'open' OR now() < r.opens_at OR now() > r.closes_at THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;

  PERFORM 1 FROM vote_round_nominees
   WHERE id = p_nominee AND round_id = p_round AND withdrawn_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_nominee' USING ERRCODE = 'P0815';
  END IF;

  SELECT id, status, removed_mode INTO v_id, v_status, v_mode
    FROM votes
   WHERE round_id = p_round AND voter_email_canonical = p_email_canonical
     AND (status = 'counted' OR removed_mode = 'fraud')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NOT NULL THEN
    IF v_mode = 'fraud' THEN
      -- Barred for the round. Same public answer as already-voted, so the
      -- bar is not a signal to the person probing it.
      RAISE EXCEPTION 'already_voted' USING ERRCODE = 'P0816';
    END IF;
    IF EXISTS (
      SELECT 1 FROM votes WHERE id = v_id AND verified_at IS NOT NULL
    ) THEN
      -- Verified, held included: a held vote is still that person's vote.
      RAISE EXCEPTION 'already_voted' USING ERRCODE = 'P0816';
    END IF;
    -- Pending: same person, new mind. Replace the choice, regenerate the
    -- code, invalidate the old one by overwriting its hash.
    UPDATE votes
       SET nominee_id = p_nominee,
           code_hash = p_code_hash,
           code_expires_at = now() + interval '15 minutes',
           ip_hash = p_ip_hash,
           user_agent = p_user_agent,
           created_at = now()
     WHERE id = v_id;
    vote_id := v_id;
    replaced := true;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO votes (
    round_id, nominee_id, voter_email_canonical,
    code_hash, code_expires_at, ip_hash, user_agent
  ) VALUES (
    p_round, p_nominee, p_email_canonical,
    p_code_hash, now() + interval '15 minutes', p_ip_hash, p_user_agent
  ) RETURNING id INTO v_id;

  vote_id := v_id;
  replaced := false;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Verifying. The code proves the inbox; the domain cap decides counted or
-- held. Accepted until fifteen minutes after close, one code lifetime, so
-- every vote cast before the whistle can still land.
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
DECLARE
  r       vote_rounds%ROWTYPE;
  v_camp  uuid;
  v       votes%ROWTYPE;
  v_domain text;
  v_used  integer;
BEGIN
  SELECT id INTO v_camp FROM campaigns WHERE slug = p_campaign_slug;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round AND campaign_id = v_camp;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF now() > r.closes_at + interval '15 minutes' THEN
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

  -- The cap. Counted votes from this domain in this round, allowlisted
  -- consumer providers exempt. Held is not a refusal: the vote is real,
  -- verified, and waits for the human the threat model always ends at.
  held := false;
  IF NOT COALESCE(p_domain_allowlisted, false) THEN
    v_domain := split_part(p_email_canonical, '@', 2);
    SELECT count(*) INTO v_used
      FROM votes v2
     WHERE v2.round_id = p_round
       AND v2.status = 'counted'
       AND v2.verified_at IS NOT NULL
       AND v2.held_at IS NULL
       AND split_part(v2.voter_email_canonical, '@', 2) = v_domain;
    IF v_used >= COALESCE(p_domain_cap, 10) THEN
      held := true;
    END IF;
  END IF;

  UPDATE votes
     SET verified_at = now(),
         held_at = CASE WHEN held THEN now() ELSE NULL END,
         code_hash = NULL,
         code_expires_at = NULL
   WHERE id = v.id;

  vote_id := v.id;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Removal, in the two modes the scope separates. Fraud bars the email for
-- the round; unsweep frees it (the schema's original intent). Post-close,
-- both only adjust the tally, since casting is over either way.
CREATE OR REPLACE FUNCTION remove_vote(
  p_admin  uuid,
  p_vote   uuid,
  p_reason text,
  p_mode   text
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v votes%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF p_mode NOT IN ('fraud', 'unsweep') THEN
    RAISE EXCEPTION 'mode_required' USING ERRCODE = 'P0818';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  SELECT * INTO v FROM votes WHERE id = p_vote FOR UPDATE;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'unknown_vote' USING ERRCODE = 'P0819';
  END IF;

  UPDATE votes
     SET status = 'removed',
         removed_reason = btrim(p_reason),
         removed_mode = p_mode,
         removed_by_admin_id = p_admin
   WHERE id = p_vote;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  SELECT r.campaign_id, p_admin, 'vote.removed', 'vote', p_vote,
         jsonb_build_object('mode', p_mode, 'round_id', v.round_id),
         btrim(p_reason)
    FROM vote_rounds r WHERE r.id = v.round_id;
END $$;

-- ---------------------------------------------------------------------------
-- Closing and the review gate. Close is explicit and audited; announce
-- refuses until the sweep is marked done, which is what makes "votes we
-- believe manipulated are set aside" a step rather than a hope.
-- Admitting a held vote: the human decided the cluster was innocent.
CREATE OR REPLACE FUNCTION release_vote(p_admin uuid, p_vote uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v votes%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT * INTO v FROM votes WHERE id = p_vote FOR UPDATE;
  IF v.id IS NULL OR v.held_at IS NULL THEN
    RAISE EXCEPTION 'unknown_vote' USING ERRCODE = 'P0819';
  END IF;
  UPDATE votes SET held_at = NULL WHERE id = p_vote;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id)
  SELECT r.campaign_id, p_admin, 'vote.released', 'vote', p_vote
    FROM vote_rounds r WHERE r.id = v.round_id;
END $$;

CREATE OR REPLACE FUNCTION close_vote_round(p_admin uuid, p_round uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r vote_rounds%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status <> 'open' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;
  UPDATE vote_rounds SET status = 'closed' WHERE id = p_round;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id)
  VALUES (r.campaign_id, p_admin, 'vote_round.closed', 'vote_round', p_round);
END $$;

CREATE OR REPLACE FUNCTION mark_round_reviewed(p_admin uuid, p_round uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r vote_rounds%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status <> 'closed' THEN
    RAISE EXCEPTION 'round_not_closed' USING ERRCODE = 'P0820';
  END IF;
  UPDATE vote_rounds
     SET reviewed_at = now(), reviewed_by_admin_id = p_admin
   WHERE id = p_round;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id)
  VALUES (r.campaign_id, p_admin, 'vote_round.reviewed', 'vote_round', p_round);
END $$;


-- ---------------------------------------------------------------------------
-- publish_weekly_winner, regenerated from 0045 with one gate added and the
-- round's terminal transition. Everything else verbatim; the lineage guard
-- holds every earlier raise.

CREATE OR REPLACE FUNCTION publish_weekly_winner(
  p_campaign_slug text,
  p_week_no       smallint,
  p_category      winner_category,
  p_enrolment     uuid,
  p_entry         uuid,
  p_prize_naira   integer,
  p_note          text,
  p_admin         uuid,
  p_publish       boolean
)
RETURNS TABLE (winner_id uuid, published boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_id       uuid;
  v_when     timestamptz := CASE WHEN p_publish THEN now() ELSE NULL END;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM campaign_creators
   WHERE id = p_enrolment AND campaign_id = v_campaign;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  -- A voided creator cannot be announced. The candidate list already omits
  -- them, but the list is a convenience and this is the rule: a name that
  -- was disqualified on Saturday must not be publishable on Sunday because
  -- it was still on somebody's screen.
  PERFORM 1 FROM campaign_creators
   WHERE id = p_enrolment AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator_not_active' USING ERRCODE = 'P0803';
  END IF;

  -- Announcing commits money against the standings, so the standings must
  -- exist: publishing requires the week to have been recorded. A draft is
  -- still allowed early, it commits nothing.
  IF p_publish AND NOT EXISTS (
    SELECT 1 FROM leaderboard_snapshots
     WHERE campaign_id = v_campaign AND week_no = p_week_no
  ) THEN
    RAISE EXCEPTION 'week_not_frozen' USING ERRCODE = 'P0804';
  END IF;

  -- Community Favourite with an on-site round: the vote decides, so the
  -- round must be closed and its suspicious-vote sweep marked done before
  -- a winner can be published against it. A week with no round (the
  -- social-poll fallback) is untouched by this gate.
  IF p_publish AND p_category = 'community_favourite' AND EXISTS (
    SELECT 1 FROM vote_rounds
     WHERE campaign_id = v_campaign AND week_no = p_week_no
  ) THEN
    PERFORM 1 FROM vote_rounds
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND status IN ('closed', 'published')
       AND reviewed_at IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'round_not_reviewed' USING ERRCODE = 'P0805';
    END IF;
  END IF;

  -- A published winner is immutable from here. The upsert used to replace
  -- the row silently, so a second announce, a double-click, or a draft
  -- saved after publishing could swap or un-publish a name and amount that
  -- were already public, with the first winner's email already sent. The
  -- lock serialises two owners racing the same slot.
  PERFORM 1 FROM weekly_winners
   WHERE campaign_id = v_campaign AND week_no = p_week_no
     AND category = p_category
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM weekly_winners
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND category = p_category AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'winner_already_published' USING ERRCODE = 'P0802';
  END IF;

  BEGIN
    INSERT INTO weekly_winners (
      campaign_id, week_no, category, campaign_creator_id, entry_id,
      prize_amount_naira, note, published_at
    ) VALUES (
      v_campaign, p_week_no, p_category, p_enrolment, p_entry,
      p_prize_naira, NULLIF(btrim(COALESCE(p_note, '')), ''), v_when
    )
    ON CONFLICT (campaign_id, week_no, category) DO UPDATE
      SET campaign_creator_id = EXCLUDED.campaign_creator_id,
          entry_id            = EXCLUDED.entry_id,
          prize_amount_naira  = EXCLUDED.prize_amount_naira,
          note                = EXCLUDED.note,
          published_at        = EXCLUDED.published_at
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The only index left that this can violate. Named, because "duplicate
      -- key value violates unique constraint" tells the admin nothing about
      -- which rule they met or why it exists.
      RAISE EXCEPTION 'already_creator_of_week' USING ERRCODE = 'P0801';
  END;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin,
    CASE WHEN p_publish THEN 'winner.published' ELSE 'winner.drafted' END,
    'weekly_winner', v_id,
    jsonb_build_object(
      'week_no', p_week_no,
      'category', p_category::text,
      'campaign_creator_id', p_enrolment,
      'prize_amount_naira', p_prize_naira
    ),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  -- The round follows the announcement into its terminal state.
  IF p_publish AND p_category = 'community_favourite' THEN
    UPDATE vote_rounds SET status = 'published'
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND status = 'closed';
  END IF;

  winner_id := v_id;
  published := p_publish;
  RETURN NEXT;
END $$;
