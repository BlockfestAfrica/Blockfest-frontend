/*
 * The stage narrative moves into the console.
 *
 * The landing page's stage cards carried three things only a deploy could
 * change: the question line ("Make Them Curious"), the focus paragraph,
 * and the skill chips. The title and the brief were already editable from
 * the console; the team asked for the rest, so a wording change on launch
 * week stops needing an engineer.
 *
 * All three columns are nullable, and NULL means "the code's registry
 * copy", so nothing changes on any card until an admin writes something.
 * Once written, the database is the voice, same as the title.
 *
 * update_challenge grows three parameters. CREATE OR REPLACE cannot add
 * parameters, it would mint an overload beside the old function and the
 * route would keep hitting whichever matched, so the old signature is
 * dropped first, the same discipline 0051 applied to award_points. The
 * body is 0047's exactly, plus the new fields; every raise is kept and
 * the lineage guard checks that mechanically.
 */

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS skills text[];

DROP FUNCTION IF EXISTS update_challenge(
  uuid, uuid, text, text, integer, challenge_status, timestamptz, timestamptz
);

CREATE OR REPLACE FUNCTION update_challenge(
  p_challenge   uuid,
  p_admin       uuid,
  p_title       text,
  p_description text,
  p_base_points integer,
  p_status      challenge_status,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_question    text,
  p_focus       text,
  p_skills      text[]
)
RETURNS TABLE (week_no smallint)
LANGUAGE plpgsql AS $$
DECLARE
  ch        challenges%ROWTYPE;
  v_title   text;
  v_desc    text;
  v_points  integer;
  v_status  challenge_status;
  v_starts  timestamptz;
  v_ends    timestamptz;
  v_question text;
  v_focus    text;
  v_skills   text[];
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = p_challenge FOR UPDATE;
  IF ch.id IS NULL THEN
    RAISE EXCEPTION 'unknown_challenge' USING ERRCODE = 'P0202';
  END IF;

  IF ch.ends_at < now() THEN
    RAISE EXCEPTION 'challenge_readonly' USING ERRCODE = 'P0907';
  END IF;

  -- NULL means keep, so the route can send only what changed.
  v_title  := COALESCE(NULLIF(btrim(p_title), ''), ch.title);
  v_desc   := COALESCE(NULLIF(btrim(p_description), ''), ch.description);
  v_points := COALESCE(p_base_points, ch.base_points);
  v_status := COALESCE(p_status, ch.status);
  v_starts := COALESCE(p_starts_at, ch.starts_at);
  v_ends   := COALESCE(p_ends_at, ch.ends_at);
  v_question := COALESCE(NULLIF(btrim(p_question), ''), ch.question);
  v_focus    := COALESCE(NULLIF(btrim(p_focus), ''), ch.focus);
  v_skills   := COALESCE(p_skills, ch.skills);

  IF v_points <= 0 THEN
    RAISE EXCEPTION 'points_required' USING ERRCODE = 'P0503';
  END IF;

  IF v_ends <= v_starts THEN
    RAISE EXCEPTION 'window_inverted' USING ERRCODE = 'P0908';
  END IF;

  -- Two open windows at once would file entries against whichever week the
  -- route's unordered pick found first. The schedule is one week at a time
  -- and the editor should refuse to make it otherwise. Only an edit that
  -- MOVES the window is judged: a title or status change on a week whose
  -- dates already overlap must not brick that week's editing.
  IF (v_starts <> ch.starts_at OR v_ends <> ch.ends_at) AND EXISTS (
    SELECT 1 FROM challenges c2
     WHERE c2.campaign_id = ch.campaign_id
       AND c2.id <> ch.id
       AND c2.starts_at < v_ends
       AND c2.ends_at > v_starts
  ) THEN
    RAISE EXCEPTION 'window_overlaps' USING ERRCODE = 'P0910';
  END IF;

  UPDATE challenges SET
    title = v_title,
    description = v_desc,
    base_points = v_points,
    status = v_status,
    starts_at = v_starts,
    ends_at = v_ends,
    question = v_question,
    focus = v_focus,
    skills = v_skills
  WHERE id = ch.id;

  /*
   * The audit carries before and after for exactly the fields that moved.
   * base_points is the one that decides money, and the snapshot rule means a
   * change here touches only entries created afterwards; the row is how a
   * dispute about which entries got which rate is answered.
   */
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after
  ) VALUES (
    ch.campaign_id, p_admin, 'challenge.updated', 'challenge', ch.id,
    jsonb_strip_nulls(jsonb_build_object(
      'title',       CASE WHEN v_title  <> ch.title       THEN jsonb_build_object('from', ch.title, 'to', v_title) END,
      'description', CASE WHEN v_desc   <> ch.description THEN jsonb_build_object('from', left(ch.description, 120), 'to', left(v_desc, 120)) END,
      'base_points', CASE WHEN v_points <> ch.base_points THEN jsonb_build_object('from', ch.base_points, 'to', v_points) END,
      'status',      CASE WHEN v_status <> ch.status      THEN jsonb_build_object('from', ch.status::text, 'to', v_status::text) END,
      'starts_at',   CASE WHEN v_starts <> ch.starts_at   THEN jsonb_build_object('from', ch.starts_at, 'to', v_starts) END,
      'ends_at',     CASE WHEN v_ends   <> ch.ends_at     THEN jsonb_build_object('from', ch.ends_at, 'to', v_ends) END,
      'question',    CASE WHEN v_question IS DISTINCT FROM ch.question THEN jsonb_build_object('from', ch.question, 'to', v_question) END,
      'focus',       CASE WHEN v_focus    IS DISTINCT FROM ch.focus    THEN jsonb_build_object('from', ch.focus, 'to', v_focus) END,
      'skills',      CASE WHEN v_skills   IS DISTINCT FROM ch.skills   THEN jsonb_build_object('from', to_jsonb(ch.skills), 'to', to_jsonb(v_skills)) END
    ))
  );

  week_no := ch.week_no;
  RETURN NEXT;
END $$;
