-- Two failures that reached a person as "Something went wrong at our end".
--
-- Both are legitimate things to attempt. Neither is a bug in the attempt. Both
-- produced a raw constraint violation that no route maps, so the one person who
-- could act on the real reason was told nothing at all.

-- ---------------------------------------------------------------------------
-- 1. Re-deciding a submission that has since been replaced.
--
-- 0011 made submission_one_per_platform_active partial on status <> 'rejected',
-- so a rejected submission frees the platform and the creator can send another.
-- That is the whole point of it, and the rejection note tells them to.
--
-- Which creates a sequence nothing handled:
--
--   reviewer rejects A
--   creator resubmits the platform, B is pending
--   reviewer decides the rejection was wrong and approves A
--
-- A leaves 'rejected', re-enters the partial index, and collides with B. The
-- reviewer gets a unique_violation the route does not map.
--
-- This is the most sympathetic case in the whole queue: somebody correcting
-- their own mistake, getting the least useful error in the system. Now it says
-- what happened and which submission to act on instead.

CREATE OR REPLACE FUNCTION review(
  p_sub    uuid,
  p_status submission_status,
  p_admin  uuid,
  p_note   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_entry uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
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
      -- The only index this UPDATE can violate is the partial one on platform,
      -- and the only way to violate it is to bring a rejected row back while a
      -- live one holds the slot.
      RAISE EXCEPTION 'superseded_by_newer_submission' USING ERRCODE = 'P0210';
  END;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM recompute_entry_award(v_entry);
END $$;

-- ---------------------------------------------------------------------------
-- 2. A correction that would take a creator below zero.
--
-- campaign_creators has carried CHECK (points_total >= 0) since 0000.
-- award_points checks min_points and max_points and then recomputes the total
-- from the ledger, so taking 100 points from somebody holding 50 passes every
-- bound the function tests and then violates the check.
--
-- Of the two defensible answers, this picks the one the schema already
-- committed to: a creator's total never goes negative. The check has been there
-- from the first migration and the leaderboard, the creator's own page and the
-- prize split all read that column, so a negative total would be a new state
-- for all three to have opinions about.
--
-- The reversal an admin actually wants is bounded by what the creator holds,
-- and the error now says what that is, so the correct smaller number is one
-- glance away rather than a guess.

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
