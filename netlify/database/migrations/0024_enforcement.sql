-- Four holes in enforcement, all of the same shape: a rule written in one place
-- and not read in the place that would have to obey it.

-- ---------------------------------------------------------------------------
-- 1. Disqualification that disqualifies.
--
-- void_enrolment sets campaign_creators.status to 'disqualified' and releases
-- the creator's verified handles. Nothing read that status. submit_entry never
-- looked at it, so a disqualified creator kept their session and kept filing
-- entries, and review() never looked at it either, so the only thing standing
-- between a voided creator and points was the handle release, which an admin
-- re-verifying a handle for an unrelated reason silently undid.
--
-- The status is now read at both gates. Submitting is refused outright, which
-- is the honest answer: a disqualified creator who can still submit is being
-- invited to keep working for nothing.

CREATE OR REPLACE FUNCTION enrolment_is_active(p_enrolment uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(status, 'active') = 'active'
    FROM campaign_creators WHERE id = p_enrolment
$$;

-- ---------------------------------------------------------------------------
-- 2. review() refuses to approve work from a voided enrolment.
--
-- Copied from 0022 with the enrolment check added, because CREATE OR REPLACE
-- needs the whole body and rewriting it from memory is how the return columns
-- got wrong last time. Rejection is still allowed: a reviewer clearing a queue
-- must be able to dispose of a disqualified creator's pending work.

CREATE OR REPLACE FUNCTION review(
  p_sub    uuid,
  p_status submission_status,
  p_admin  uuid,
  p_note   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_entry    uuid;
  v_platform platform;
  v_verified timestamptz;
  v_active   boolean;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  IF p_status = 'approved' THEN
    SELECT s.platform, csh.verified_at, COALESCE(cc.status, 'active') = 'active'
      INTO v_platform, v_verified, v_active
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      LEFT JOIN creator_social_handles csh
        ON csh.creator_id = cc.creator_id AND csh.platform = s.platform
     WHERE s.id = p_sub;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Before the handle check, because "this creator is disqualified" is the
    -- more useful sentence when both are true.
    IF NOT v_active THEN
      RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
    END IF;

    IF v_verified IS NULL THEN
      RAISE EXCEPTION 'handle_not_verified' USING ERRCODE = 'P0211';
    END IF;
  END IF;

  BEGIN
    UPDATE submissions
       SET status = p_status,
           reviewed_at = now(),
           reviewed_by_admin_id = p_admin,
           review_note = COALESCE(p_note, review_note)
     WHERE id = p_sub
     RETURNING entry_id INTO v_entry;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'superseded_by_newer_submission' USING ERRCODE = 'P0210';
  END;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM recompute_entry_award(v_entry);
END $$;

-- ---------------------------------------------------------------------------
-- 3. The referrer's row is locked before their total is recomputed.
--
-- 0014 locks the referrals row, which serialises two approvals racing to pay
-- one referral, and that part is right. It then recomputes the REFERRER's
-- points_total while holding no lock on the referrer at all. award_points
-- locks that row before doing the same recompute, so an admin awarding a bonus
-- to the referrer at the moment a referral pays out is two writers recomputing
-- one cached total from the ledger with no ordering between them. That is the
-- cache-loss bug 0003 was written to remove, reintroduced in the one place
-- 0003 did not reach.
--
-- The whole of pay_referral_if_due is not rewritten here. The recompute is
-- replaced by a function that takes the lock first, so the ordering is in one
-- place and every future caller inherits it.

CREATE OR REPLACE FUNCTION recompute_points_total(p_enrolment uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_total integer;
BEGIN
  -- The lock, then the read, then the write. Taking it here rather than asking
  -- every caller to remember is the point.
  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  UPDATE campaign_creators cc SET
    points_total = (
      SELECT COALESCE(sum(points), 0) FROM point_ledger
       WHERE campaign_creator_id = p_enrolment
    )
   WHERE cc.id = p_enrolment
  RETURNING cc.points_total INTO v_total;

  RETURN COALESCE(v_total, 0);
END $$;

-- ---------------------------------------------------------------------------
-- 4. A ceiling on manual awards in aggregate, not only per call.
--
-- 0016 bounded each award: 300 points, 600 for a wildcard. It did not bound the
-- total, so the same admin could award 300 points two hundred times to one
-- creator and every single call would pass every check. /api/admin/award is
-- open to reviewers as well as owners and has no rate limit, so this is one
-- compromised reviewer session away from deciding the leaderboard.
--
-- The cap is per creator per campaign across every manual source, and it lives
-- in point_rules so it can be changed without a migration. 2000 is a policy
-- choice rather than a derived number: it is about seven maximum size bonuses,
-- which is generous for a 33 day campaign, and it is far below what is needed
-- to move somebody to the top of a leaderboard from nothing. Raise it in
-- point_rules if the campaign wants to.

INSERT INTO point_rules (campaign_id, key, default_points, min_points, max_points)
SELECT c.id, 'manual_total_cap', 2000, 0, 2000
  FROM campaigns c
 WHERE c.slug = 'monica-money-story'
   AND NOT EXISTS (
     SELECT 1 FROM point_rules pr
      WHERE pr.campaign_id = c.id AND pr.key = 'manual_total_cap'
   );


-- ---------------------------------------------------------------------------
-- submit_entry, with the enrolment status read.
--
-- Regenerated from the migration that last defined it with one change applied,
-- never retyped. CREATE OR REPLACE needs the whole body, and rewriting a body
-- from memory is how the return columns got wrong the last time.

CREATE OR REPLACE FUNCTION submit_entry(
  p_enrolment        uuid,
  p_challenge        uuid,
  p_platform         platform,
  p_url              text,
  p_allow_before_open boolean,
  p_author           text
)
RETURNS TABLE (submission_id uuid, entry_id uuid, is_first_for_entry boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign   uuid;
  v_creator    uuid;
  v_entry      uuid;
  v_base       integer;
  v_bonus2     integer;
  v_bonus3     integer;
  v_created    boolean := false;
  v_author     text := lower(btrim(COALESCE(p_author, '')));
  ch           challenges%ROWTYPE;
BEGIN
  SELECT campaign_id, creator_id INTO v_campaign, v_creator
    FROM campaign_creators WHERE id = p_enrolment;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  -- Voided by an admin. Refused here rather than at review, because a
  -- disqualified creator who can still submit is being invited to keep working
  -- for nothing, and finds out days later.
  IF NOT enrolment_is_active(p_enrolment) THEN
    RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = p_challenge;
  IF ch.id IS NULL OR ch.campaign_id <> v_campaign THEN
    RAISE EXCEPTION 'unknown_challenge' USING ERRCODE = 'P0202';
  END IF;

  IF ch.status <> 'active' THEN
    RAISE EXCEPTION 'challenge_closed' USING ERRCODE = 'P0203';
  END IF;

  IF now() < ch.starts_at AND NOT COALESCE(p_allow_before_open, false) THEN
    RAISE EXCEPTION 'challenge_not_open' USING ERRCODE = 'P0204';
  END IF;

  IF now() > ch.ends_at THEN
    RAISE EXCEPTION 'challenge_ended' USING ERRCODE = 'P0205';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator AND platform = p_platform
  ) THEN
    RAISE EXCEPTION 'platform_not_registered' USING ERRCODE = 'P0206';
  END IF;

  -- Where the platform puts the author in the link, it has to be their account.
  IF v_author <> '' AND NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator
       AND platform = p_platform
       AND lower(handle_normalized) = v_author
  ) THEN
    RAISE EXCEPTION 'wrong_account' USING ERRCODE = 'P0209';
  END IF;

  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  SELECT id INTO v_entry FROM challenge_entries
   WHERE campaign_creator_id = p_enrolment AND challenge_id = p_challenge;

  IF v_entry IS NULL THEN
    SELECT
      COALESCE(max(CASE WHEN key = 'entry_base' THEN default_points END), ch.base_points),
      COALESCE(max(CASE WHEN key = 'multi_platform_bonus_2' THEN default_points END), 0),
      COALESCE(max(CASE WHEN key = 'multi_platform_bonus_3' THEN default_points END), 0)
      INTO v_base, v_bonus2, v_bonus3
      FROM point_rules WHERE campaign_id = v_campaign;

    INSERT INTO challenge_entries (
      campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot
    ) VALUES (
      p_enrolment, p_challenge, v_base, v_bonus2, v_bonus3
    ) RETURNING id INTO v_entry;

    v_created := true;
  END IF;

  BEGIN
    INSERT INTO submissions (entry_id, platform, url)
    VALUES (v_entry, p_platform, p_url)
    RETURNING id INTO submission_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Matched to the index that actually fired. Both candidates are
      -- partial on status <> 'rejected', so a rejected row is not a
      -- collision and must not be reported as one.
      IF EXISTS (
        SELECT 1 FROM submissions s
         WHERE s.entry_id = v_entry
           AND s.platform = p_platform
           AND s.status <> 'rejected'
      ) THEN
        RAISE EXCEPTION 'already_submitted_for_platform' USING ERRCODE = 'P0207';
      END IF;
      RAISE EXCEPTION 'url_already_submitted' USING ERRCODE = 'P0208';
  END;

  entry_id := v_entry;
  is_first_for_entry := v_created;
  RETURN NEXT;
END $$;


-- ---------------------------------------------------------------------------
-- recompute_entry_award, recomputing under the referrer's lock.
--
-- Regenerated from the migration that last defined it with one change applied,
-- never retyped. CREATE OR REPLACE needs the whole body, and rewriting a body
-- from memory is how the return columns got wrong the last time.

CREATE OR REPLACE FUNCTION recompute_entry_award(p_entry uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_n        smallint;
  v_target   integer;
  v_current  integer;
  v_delta    integer;
  v_cc       uuid;
  v_campaign uuid;
  v_entries  integer;
  v_was_approved_before boolean;
  v_referral referrals%ROWTYPE;
  v_referral_points integer;
  v_ledger_id uuid;
  e          challenge_entries%ROWTYPE;
BEGIN
  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;

  SELECT campaign_creator_id INTO v_cc FROM challenge_entries WHERE id = p_entry;
  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = v_cc;

  PERFORM 1 FROM campaign_creators WHERE id = v_cc FOR UPDATE;

  -- Captured before the update below, because the whole referral question is
  -- whether this approval is the creator's first.
  SELECT first_approved_at IS NOT NULL INTO v_was_approved_before
    FROM campaign_creators WHERE id = v_cc;

  SELECT count(*) INTO v_n FROM submissions
   WHERE entry_id = p_entry AND status = 'approved';

  v_target := CASE
    WHEN v_n = 0 THEN 0
    WHEN v_n = 1 THEN e.base_points_snapshot
    WHEN v_n = 2 THEN e.base_points_snapshot + e.bonus_2_snapshot
    ELSE            e.base_points_snapshot + e.bonus_3_snapshot
  END;

  SELECT COALESCE(sum(points),0) INTO v_current FROM point_ledger
   WHERE entry_id = p_entry AND source = 'challenge_entry';

  v_delta := v_target - v_current;

  IF v_delta <> 0 THEN
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, entry_id)
    VALUES (v_campaign, v_cc, 'challenge_entry', v_delta, p_entry);
  END IF;

  UPDATE challenge_entries
     SET approved_platform_count = v_n, awarded_points = v_target, updated_at = now()
   WHERE id = p_entry;

  SELECT count(*) INTO v_entries FROM challenge_entries
   WHERE campaign_creator_id = v_cc AND approved_platform_count >= 1;

  UPDATE campaign_creators cc SET
    points_total = (SELECT COALESCE(sum(points),0) FROM point_ledger WHERE campaign_creator_id = v_cc),
    approved_entries_count = v_entries,
    first_approved_at = CASE
      WHEN v_entries >= 1 THEN COALESCE(cc.first_approved_at, now())
      ELSE cc.first_approved_at
    END
   WHERE cc.id = v_cc;

  -- ---------------------------------------------------------------------
  -- The referral, paid once, on the first approval and never again.
  IF NOT v_was_approved_before AND v_entries >= 1 THEN
    -- Locked rather than claimed by writing awarded_at first. The
    -- referral_award_consistent CHECK requires awarded_at and awarded_ledger_id
    -- to be set together, so there is no half state to claim with: the row
    -- lock is what serialises two approvals racing for one creator.
    SELECT * INTO v_referral FROM referrals
     WHERE referred_campaign_creator_id = v_cc
       AND awarded_at IS NULL
     FOR UPDATE;

    IF v_referral.id IS NOT NULL THEN
      SELECT COALESCE(default_points, 0) INTO v_referral_points
        FROM point_rules
       WHERE campaign_id = v_campaign AND key = 'referral';

      -- Nothing configured means nothing is paid and the referral stays
      -- payable, rather than being marked paid for zero and lost.
      IF COALESCE(v_referral_points, 0) > 0 THEN
        BEGIN
          INSERT INTO point_ledger (
            campaign_id, campaign_creator_id, source, points, idempotency_key, note
          ) VALUES (
            v_campaign,
            v_referral.referrer_campaign_creator_id,
            'referral',
            v_referral_points,
            'referral:' || v_referral.id::text,
            'Referred creator had their first approved entry.'
          )
          RETURNING id INTO v_ledger_id;
        EXCEPTION
          WHEN unique_violation THEN
            -- Already paid for this referral. The idempotency key is the
            -- second guard behind the row lock, and it holds even if this
            -- function is ever called from somewhere that does not take one.
            v_ledger_id := NULL;
        END;

        IF v_ledger_id IS NOT NULL THEN
          -- Both fields together, which is what the CHECK requires and what
          -- makes "paid" mean "there is a ledger row proving it".
          UPDATE referrals
             SET awarded_at = now(), awarded_ledger_id = v_ledger_id
           WHERE id = v_referral.id;

          -- Recomputed from the ledger rather than incremented, and now through
          -- the function that takes the referrer's row lock first. The lock
          -- above is on the referrals row, which serialises two approvals
          -- racing to pay one referral. It says nothing about the referrer,
          -- whose cached total this writes.
          PERFORM recompute_points_total(v_referral.referrer_campaign_creator_id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_target;
END $$;


-- ---------------------------------------------------------------------------
-- award_points, bounded in aggregate as well as per call.
--
-- Regenerated from 0020, which is its LATEST definition, not from 0016 where it
-- was introduced. The first attempt at this migration took the body from 0016
-- and silently reverted the would_go_negative check 0020 added, because CREATE
-- OR REPLACE replaces the whole body and says nothing about what it dropped.
-- The integration suite caught it. The guard in
-- __tests__/integration/function-lineage.test.ts now catches it directly.

CREATE OR REPLACE FUNCTION award_points(
  p_enrolment uuid,
  p_source    ledger_source,
  p_points    integer,
  p_note      text,
  p_admin     uuid
)
RETURNS TABLE (ledger_id uuid, points_total integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_note     text := btrim(COALESCE(p_note, ''));
  v_min      integer;
  v_max      integer;
  v_held     integer;
  v_total    integer;
  v_cap      integer;
  v_manual   integer;
  v_id       uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF p_source IN ('challenge_entry', 'referral') THEN
    RAISE EXCEPTION 'source_not_manual' USING ERRCODE = 'P0501';
  END IF;

  IF v_note = '' THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = 'P0502';
  END IF;

  IF COALESCE(p_points, 0) = 0 THEN
    RAISE EXCEPTION 'points_required' USING ERRCODE = 'P0503';
  END IF;

  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = p_enrolment;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  SELECT min_points, max_points INTO v_min, v_max
    FROM point_rules
   WHERE campaign_id = v_campaign AND key = p_source::text;

  IF v_min IS NULL AND v_max IS NULL THEN
    RAISE EXCEPTION 'no_bounds_configured' USING ERRCODE = 'P0504';
  END IF;

  IF v_min IS NOT NULL AND p_points < v_min THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = 'P0505';
  END IF;

  IF v_max IS NOT NULL AND p_points > v_max THEN
    RAISE EXCEPTION 'above_maximum' USING ERRCODE = 'P0506';
  END IF;

  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  /*
   * The aggregate ceiling, checked under the lock just taken so two concurrent
   * awards cannot both read a total below the cap and both pass.
   *
   * Only positive awards are capped. A reversal has to stay possible, or an
   * admin who reaches the ceiling by mistake has no way to undo it.
   */
  SELECT COALESCE(max_points, 0) INTO v_cap
    FROM point_rules
   WHERE campaign_id = v_campaign AND key = 'manual_total_cap';

  IF COALESCE(v_cap, 0) > 0 AND p_points > 0 THEN
    SELECT COALESCE(sum(points), 0) INTO v_manual
      FROM point_ledger
     WHERE campaign_creator_id = p_enrolment
       AND source NOT IN ('challenge_entry', 'referral');

    IF v_manual + p_points > v_cap THEN
      -- Carries both figures, because the admin's next move is a smaller award
      -- and guessing the remaining headroom is the slow way to find it.
      RAISE EXCEPTION 'manual_cap_exceeded: cap % holds %', v_cap, v_manual
        USING ERRCODE = 'P0508';
    END IF;
  END IF;

  -- Read the total under the lock taken above, so two admins correcting at once
  -- cannot each see enough points for a deduction that only one of them can
  -- have.
  SELECT cc.points_total INTO v_held
    FROM campaign_creators cc WHERE cc.id = p_enrolment;

  IF v_held + p_points < 0 THEN
    RAISE EXCEPTION 'would_go_negative: holds %', v_held USING ERRCODE = 'P0507';
  END IF;

  INSERT INTO point_ledger (
    campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id
  ) VALUES (
    v_campaign, p_enrolment, p_source, p_points, v_note, p_admin
  ) RETURNING id INTO v_id;

  UPDATE campaign_creators cc SET
    points_total = (
      SELECT COALESCE(sum(points), 0) FROM point_ledger
       WHERE campaign_creator_id = p_enrolment
    )
   WHERE cc.id = p_enrolment
  RETURNING cc.points_total INTO v_total;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'points.awarded', 'campaign_creator', p_enrolment,
    jsonb_build_object('source', p_source::text, 'points', p_points),
    v_note
  );

  ledger_id := v_id;
  points_total := v_total;
  RETURN NEXT;
END $$;
