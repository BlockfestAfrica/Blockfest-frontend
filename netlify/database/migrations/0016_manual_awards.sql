-- Let an admin award a bonus, within bounds, with their name on it.
--
-- The campaign page says "Bonuses go to work that is genuinely good, gets
-- featured, or brings another creator in." Referral is paid now. The other two
-- have never been possible: seven ledger sources exist and nothing could write
-- six of them, so an admin wanting to reward a standout entry had no mechanism
-- at all. First reviews are around 20 September.
--
-- Two things the schema already gets right and this keeps. The ledger CHECK
-- refuses a manual award that names no admin and carries no note, so
-- attribution is not a convention here. And the ledger is append-only: taking a
-- bonus back is a signed negative row, never an edit, so the history of a
-- decision survives the decision changing.
--
-- What was missing is bounds. point_rules has carried min_points and max_points
-- since the first migration with nothing reading them, which the security
-- review flagged: a typo of 5000 instead of 500 on a 5,000,000 naira pool is
-- one keystroke, and nothing stood between it and the leaderboard.

-- Ceilings for the bonuses the copy promises. Generous enough not to be in the
-- way, tight enough that a slipped digit is refused rather than paid.
INSERT INTO point_rules (campaign_id, key, default_points, min_points, max_points)
SELECT c.id, v.key, v.pts, v.lo, v.hi
FROM campaigns c
CROSS JOIN (VALUES
  ('quality_bonus',         50,  -300, 300),
  ('engagement_milestone',  50,  -300, 300),
  ('featured_blockfest',   100,  -300, 300),
  ('featured_monica',      100,  -300, 300),
  ('collab',                50,  -300, 300),
  ('wildcard_win',         200,  -600, 600),
  -- The catch-all, deliberately the tightest, because it is the one reached
  -- for when none of the others fit and the reason is least considered.
  ('manual_adjustment',      0,  -300, 300)
) AS v(key, pts, lo, hi)
WHERE c.slug = 'monica-money-story'
  AND NOT EXISTS (
    SELECT 1 FROM point_rules pr WHERE pr.campaign_id = c.id AND pr.key = v.key
  );

-- Bounds for the rules that already existed and had none.
UPDATE point_rules pr SET min_points = -600, max_points = 600
  FROM campaigns c
 WHERE c.id = pr.campaign_id
   AND c.slug = 'monica-money-story'
   AND pr.key = 'referral'
   AND pr.min_points IS NULL;

-- ---------------------------------------------------------------------------
-- Award, or take back, by hand.
--
-- One function, so bounds cannot be skipped by a caller that forgets them, and
-- so every manual movement of points looks the same in the ledger and the audit
-- log whoever triggered it.

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
  v_total    integer;
  v_id       uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  -- These two are written by the engine, from a submission and from a
  -- referral. Allowing them here would let a hand award masquerade as one the
  -- system computed, and recompute_entry_award would then fight it.
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

  -- A source with no rule row has no ceiling, which is not a decision anybody
  -- made. Refused rather than allowed, because the failure of an absent rule
  -- should be nothing happening, not anything being possible.
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

  INSERT INTO point_ledger (
    campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id
  ) VALUES (
    v_campaign, p_enrolment, p_source, p_points, v_note, p_admin
  ) RETURNING id INTO v_id;

  -- Recomputed from the ledger, never incremented, like every other total here.
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
