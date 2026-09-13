-- Two holes the adversarial review of the shipped fixes found.
--
-- First, the aggregate award cap was invertible. It bounded what manual awards
-- can add, and exempted negative awards so reversals stay possible, which
-- means a compromised reviewer session could not inflate an ally past 2000 but
-- could drain every rival to zero at three hundred points a call. Deciding a
-- leaderboard by lowering the others pays exactly as well as raising your own.
-- award_points gains the matching floor: manual sources collectively can never
-- take more than they gave.
--
-- Second, review()'s disqualification check could race void_enrolment. The
-- status was read without a lock, so an approval in flight while an admin
-- voided the creator could pay points, and the referral, to somebody
-- disqualified a moment before. The read now takes the enrolment's row lock.
--
-- Both functions are regenerated from their latest definitions (0024 and
-- 0025). The lineage guard fails the build if either drops a rule it had.

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
    /*
     * FOR UPDATE OF cc, so the status read cannot race void_enrolment.
     *
     * Without the lock there is a window: the reviewer's approval reads
     * status = 'active', an admin's void commits, and the approval then pays
     * points to a creator who was disqualified a moment before, including the
     * referral their first approval triggers. OF cc names the inner joined
     * table only, because FOR UPDATE cannot take the nullable side of the
     * LEFT JOIN, and it is only the enrolment row whose stability matters.
     */
    SELECT s.platform, csh.verified_at, COALESCE(cc.status, 'active') = 'active'
      INTO v_platform, v_verified, v_active
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      LEFT JOIN creator_social_handles csh
        ON csh.creator_id = cc.creator_id AND csh.platform = s.platform
     WHERE s.id = p_sub
       FOR UPDATE OF cc;

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

    /*
     * Somebody else is already credited for this post.
     *
     * Checked by name rather than left to the unique index, because the index
     * raises unique_violation and the handler below maps that to
     * superseded_by_newer_submission, which is a different situation and the
     * wrong sentence to put in front of a reviewer.
     */
    IF EXISTS (
      SELECT 1
        FROM submissions other
        JOIN submissions mine ON mine.id = p_sub
       WHERE other.id <> p_sub
         AND other.status = 'approved'
         AND other.post_identity = mine.post_identity
    ) THEN
      RAISE EXCEPTION 'post_already_credited' USING ERRCODE = 'P0213';
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

  /*
   * The floor, which the ceiling turned out to imply and did not deliver.
   *
   * The cap bounded what manual awards can add and exempted negative awards so
   * reversals stay possible. The adversarial review inverted it: with no
   * aggregate floor, a compromised reviewer session cannot inflate an ally
   * past 2000 but can DRAIN every rival to zero, three hundred points per
   * call, and deciding a leaderboard by lowering the others pays exactly as
   * well as raising your own.
   *
   * So manual sources collectively can never take more than they gave: the
   * creator's net manual sum stays at or above zero. Reversing your own award
   * always fits inside that. Removing points the ENGINE awarded is not a
   * correction, it is a disqualification, and void_enrolment is the tool that
   * does that with a reason, an audit row and a referral clawback.
   */
  IF p_points < 0 THEN
    SELECT COALESCE(sum(points), 0) INTO v_manual
      FROM point_ledger
     WHERE campaign_creator_id = p_enrolment
       AND source NOT IN ('challenge_entry', 'referral');

    IF v_manual + p_points < 0 THEN
      RAISE EXCEPTION 'manual_floor_exceeded: holds % manual', v_manual
        USING ERRCODE = 'P0509';
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


-- ---------------------------------------------------------------------------
-- purge_campaign_data, with the votes count told the truth about.
--
-- 0026 inserted the request_throttle DELETE between the votes DELETE and the
-- GET DIAGNOSTICS that was meant to capture it, so ROW_COUNT had already been
-- overwritten and the purge reported the throttle count under the votes name.
-- The rows were deleted either way; only the accounting lied, which is still a
-- lie in the one report an owner reads while destroying data. 0026 is applied,
-- so the correction is this redefinition, regenerated from 0026 with the block
-- moved below the capture it was sitting inside.

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
