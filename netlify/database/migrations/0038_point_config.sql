-- Every point value admin-configurable, with the two rails that make that
-- safe (#68).
--
-- The brief made configurability a hard requirement, and the schema has held
-- the values in point_rules since day one; what was missing was an audited
-- way to change them. The rails matter more than the editing:
--
-- Rail one: changes are forward-only by construction. Entries snapshot their
-- rates at creation, so an edit reaches the next entry and never re-ranks the
-- past. That was already true and already tested; the screen says it loudly.
--
-- Rail two: when an admin genuinely wants one entry brought to current rates,
-- that is an explicit, audited act against a named entry, never a side effect.
-- A configurable system that recomputes history on edit is a trapdoor where
-- one well-meant change silently re-ranks everybody.

CREATE OR REPLACE FUNCTION update_point_rule(
  p_rule    uuid,
  p_admin   uuid,
  p_default integer,
  p_min     integer,
  p_max     integer
)
RETURNS TABLE (rule_key text)
LANGUAGE plpgsql AS $$
DECLARE
  r         point_rules%ROWTYPE;
  v_default integer;
  v_min     integer;
  v_max     integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO r FROM point_rules WHERE id = p_rule FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'rule_not_found' USING ERRCODE = 'P0909';
  END IF;

  v_default := COALESCE(p_default, r.default_points);
  v_min     := COALESCE(p_min, r.min_points);
  v_max     := COALESCE(p_max, r.max_points);

  -- A floor above its ceiling is a rule nothing can satisfy.
  IF v_min IS NOT NULL AND v_max IS NOT NULL AND v_min > v_max THEN
    RAISE EXCEPTION 'bounds_inverted' USING ERRCODE = 'P0910';
  END IF;

  UPDATE point_rules SET
    default_points = v_default,
    min_points = v_min,
    max_points = v_max
  WHERE id = r.id;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after
  ) VALUES (
    r.campaign_id, p_admin, 'point_rule.updated', 'point_rule', r.id,
    jsonb_strip_nulls(jsonb_build_object(
      'key', r.key,
      'default_points', CASE WHEN v_default IS DISTINCT FROM r.default_points THEN jsonb_build_object('from', r.default_points, 'to', v_default) END,
      'min_points',     CASE WHEN v_min     IS DISTINCT FROM r.min_points     THEN jsonb_build_object('from', r.min_points, 'to', v_min) END,
      'max_points',     CASE WHEN v_max     IS DISTINCT FROM r.max_points     THEN jsonb_build_object('from', r.max_points, 'to', v_max) END
    ))
  );

  rule_key := r.key;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Bring ONE entry to current rates, on purpose, with a name on it.

CREATE OR REPLACE FUNCTION reprice_entry(
  p_entry  uuid,
  p_admin  uuid,
  p_reason text
)
RETURNS TABLE (points_before integer, points_after integer)
LANGUAGE plpgsql AS $$
DECLARE
  e        challenge_entries%ROWTYPE;
  ch       challenges%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_b2     integer;
  v_b3     integer;
  v_before integer;
  v_after  integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;
  IF e.id IS NULL THEN
    RAISE EXCEPTION 'entry_not_found' USING ERRCODE = 'P0911';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = e.challenge_id;

  SELECT
    COALESCE(max(CASE WHEN key = 'multi_platform_bonus_2' THEN default_points END), 0),
    COALESCE(max(CASE WHEN key = 'multi_platform_bonus_3' THEN default_points END), 0)
    INTO v_b2, v_b3
    FROM point_rules WHERE campaign_id = ch.campaign_id;

  SELECT points_total INTO v_before
    FROM campaign_creators WHERE id = e.campaign_creator_id;

  UPDATE challenge_entries SET
    base_points_snapshot = ch.base_points,
    bonus_2_snapshot = v_b2,
    bonus_3_snapshot = v_b3
  WHERE id = e.id;

  -- The engine's own reconciliation, so a reprice can never invent a total
  -- the ordinary path could not produce.
  PERFORM recompute_entry_award(e.id);

  SELECT points_total INTO v_after
    FROM campaign_creators WHERE id = e.campaign_creator_id;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    ch.campaign_id, p_admin, 'entry.repriced', 'challenge_entry', e.id,
    jsonb_build_object(
      'base', jsonb_build_object('from', e.base_points_snapshot, 'to', ch.base_points),
      'bonus_2', jsonb_build_object('from', e.bonus_2_snapshot, 'to', v_b2),
      'bonus_3', jsonb_build_object('from', e.bonus_3_snapshot, 'to', v_b3),
      'points_total', jsonb_build_object('from', v_before, 'to', v_after)
    ),
    v_reason
  );

  points_before := v_before;
  points_after  := v_after;
  RETURN NEXT;
END $$;
