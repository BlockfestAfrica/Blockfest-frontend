-- Let the submission flow be walked before the first week opens.
--
-- Registration is already forced open ahead of launch so the flow can be
-- tested. The challenge window is a separate gate and was not, so a submission
-- was refused with challenge_not_open until 14 September and nobody could
-- exercise submit, review and score until the day all three had to work.
--
-- The override lifts exactly one check: not open yet. It deliberately does NOT
-- lift challenge_ended or challenge_closed.
--
-- That asymmetry is the safety. Opening an upcoming week early affects only the
-- days before launch, and after 14 September some week is open continuously
-- until 17 October, so this branch stops being reachable at all. Reopening a
-- finished week would be different in kind: it would let an entry be filed
-- against a challenge that has already been scored and, in week four, against
-- one whose results decide the final leaderboard.
--
-- It is a server-side argument. Nothing a client sends reaches it.

DROP FUNCTION IF EXISTS submit_entry(uuid, uuid, platform, text);

CREATE FUNCTION submit_entry(
  p_enrolment        uuid,
  p_challenge        uuid,
  p_platform         platform,
  p_url              text,
  p_allow_before_open boolean
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
  ch           challenges%ROWTYPE;
BEGIN
  SELECT campaign_id, creator_id INTO v_campaign, v_creator
    FROM campaign_creators WHERE id = p_enrolment;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = p_challenge;
  IF ch.id IS NULL OR ch.campaign_id <> v_campaign THEN
    RAISE EXCEPTION 'unknown_challenge' USING ERRCODE = 'P0202';
  END IF;

  IF ch.status <> 'active' THEN
    RAISE EXCEPTION 'challenge_closed' USING ERRCODE = 'P0203';
  END IF;

  -- The only check the override touches.
  IF now() < ch.starts_at AND NOT COALESCE(p_allow_before_open, false) THEN
    RAISE EXCEPTION 'challenge_not_open' USING ERRCODE = 'P0204';
  END IF;

  -- Never overridden. A week that has ended stays ended.
  IF now() > ch.ends_at THEN
    RAISE EXCEPTION 'challenge_ended' USING ERRCODE = 'P0205';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator AND platform = p_platform
  ) THEN
    RAISE EXCEPTION 'platform_not_registered' USING ERRCODE = 'P0206';
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
      IF EXISTS (
        SELECT 1 FROM submissions s
         WHERE s.entry_id = v_entry AND s.platform = p_platform
      ) THEN
        RAISE EXCEPTION 'already_submitted_for_platform' USING ERRCODE = 'P0207';
      END IF;
      RAISE EXCEPTION 'url_already_submitted' USING ERRCODE = 'P0208';
  END;

  entry_id := v_entry;
  is_first_for_entry := v_created;
  RETURN NEXT;
END $$;
