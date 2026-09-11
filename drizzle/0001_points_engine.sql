-- The points engine, as a single idempotent reconciliation function.
-- Called after ANY submission status change. Writes target-minus-current as a
-- signed ledger row, so running it twice is a no-op and no order of reviews
-- can double-award.
CREATE OR REPLACE FUNCTION recompute_entry_award(p_entry uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_n        smallint;
  v_target   integer;
  v_current  integer;
  v_delta    integer;
  v_cc       uuid;
  v_campaign uuid;
  e          challenge_entries%ROWTYPE;
BEGIN
  -- Lock the entry: two admins approving two platforms at the same instant
  -- must serialise here, or both read the same "current" and both write a
  -- full award.
  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;

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

  SELECT campaign_creator_id INTO v_cc FROM challenge_entries WHERE id = p_entry;
  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = v_cc;

  IF v_delta <> 0 THEN
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, entry_id)
    VALUES (v_campaign, v_cc, 'challenge_entry', v_delta, p_entry);
  END IF;

  UPDATE challenge_entries
     SET approved_platform_count = v_n, awarded_points = v_target, updated_at = now()
   WHERE id = p_entry;

  -- Caches recomputed from truth, never incremented blindly.
  UPDATE campaign_creators cc SET
    points_total = (SELECT COALESCE(sum(points),0) FROM point_ledger WHERE campaign_creator_id = v_cc),
    approved_entries_count = (SELECT count(*) FROM challenge_entries
                               WHERE campaign_creator_id = v_cc AND approved_platform_count >= 1)
   WHERE cc.id = v_cc;

  RETURN v_target;
END $$;

-- Review a platform and immediately reconcile.
CREATE OR REPLACE FUNCTION review(p_sub uuid, p_status submission_status)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_entry uuid;
BEGIN
  UPDATE submissions SET status = p_status, reviewed_at = now()
   WHERE id = p_sub RETURNING entry_id INTO v_entry;
  PERFORM recompute_entry_award(v_entry);
END $$;
