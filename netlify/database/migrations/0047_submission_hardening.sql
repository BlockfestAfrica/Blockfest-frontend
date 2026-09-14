-- Submission window and authorship hardening, from the day-one audit.
--
-- Numbered 0047, renamed from 0043 before it was ever applied: the PRs
-- carrying 0043 and 0044 merged in the opposite order to their numbers,
-- 0044 deployed first, and Netlify then refused 0043 as out of order on
-- every later deploy. A migration that has never been applied may be
-- renamed; one that has, never.
--
-- Two holes, one migration, both functions regenerated from their 0037
-- definitions with everything else verbatim:
--
-- 1. submit_entry honoured p_allow_before_open at any date. The flag is the
--    pre-launch walkthrough switch, the env var behind it outlived launch,
--    and every review Sunday (no open week) the submit route fell through to
--    offering the NEXT week, which this bypass then accepted: entries filed
--    into an unopened week, a day early, every week. The override now only
--    works while the campaign itself has not started.
--
-- 2. update_challenge accepted overlapping windows, and the route picks the
--    open challenge with an unordered LIMIT 1, so overlap would file entries
--    against an arbitrary week. The editor now refuses overlap (P0910).

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

  /*
   * Already credited to somebody. Refused here, at submit, not left to review.
   *
   * The index below only constrains approved rows, so a pending insert never
   * collides and unique_violation cannot fire for this case any more. Without
   * this check a creator would paste a link, be told it went through, do the
   * rest of the week's work believing it counted, and find out at review. The
   * whole reason the old index was partial on status was to give that answer
   * early, and losing it would be a worse bug than the one 0025 fixes.
   *
   * A merely pending claim is deliberately NOT checked. That is the burn.
   */
  IF EXISTS (
    SELECT 1 FROM submissions s
     WHERE s.status = 'approved'
       AND s.post_identity = post_identity_of(p_url, p_platform)
  ) THEN
    RAISE EXCEPTION 'url_already_submitted' USING ERRCODE = 'P0208';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = p_challenge;
  IF ch.id IS NULL OR ch.campaign_id <> v_campaign THEN
    RAISE EXCEPTION 'unknown_challenge' USING ERRCODE = 'P0202';
  END IF;

  IF ch.status <> 'active' THEN
    RAISE EXCEPTION 'challenge_closed' USING ERRCODE = 'P0203';
  END IF;

  -- The pre-launch walkthrough flag dies with the launch. It used to lift
  -- this gate unconditionally, and since the env flag outlived 14 September
  -- it reopened the NEXT week every review Sunday: the route offered the
  -- upcoming challenge and this guard waved it through. Now the override
  -- only counts while the campaign itself has not started, which is the
  -- only period it was ever for.
  IF now() < ch.starts_at AND NOT (
    COALESCE(p_allow_before_open, false)
    AND now() < (SELECT starts_at FROM campaigns WHERE id = v_campaign)
  ) THEN
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
      -- The week's own value, not the campaign-wide entry_base rule.
      --
      -- Since 0004 the rule overrode the column, so challenges.base_points was
      -- a number the engine ignored, which nobody noticed while every week was
      -- 100. The challenge editor (#67) made it a lie with a text box in front
      -- of it: an owner would set week 4 to 150, the page would say 150, and
      -- every entry would still snapshot 100. The test asserting the editor's
      -- snapshot behaviour is what caught it. Precedence flips here; the
      -- entry_base rule row stays behind as documentation of the old default.
      ch.base_points,
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


CREATE OR REPLACE FUNCTION update_challenge(
  p_challenge   uuid,
  p_admin       uuid,
  p_title       text,
  p_description text,
  p_base_points integer,
  p_status      challenge_status,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz
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
    ends_at = v_ends
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
      'ends_at',     CASE WHEN v_ends   <> ch.ends_at     THEN jsonb_build_object('from', ch.ends_at, 'to', v_ends) END
    ))
  );

  week_no := ch.week_no;
  RETURN NEXT;
END $$;
