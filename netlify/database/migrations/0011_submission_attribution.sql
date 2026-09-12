-- Require a submitted post to come from the account the creator registered.
--
-- The only ownership test was whether the creator had registered SOME handle on
-- that platform. It never asked whether that handle was the one in the link. So
-- anybody could complete the public registration with any handle string, wait
-- for a rival to publish a strong post, and submit their URL. The reviewer saw
-- a bare link, opened a real on-brief post, approved it, and the points went to
-- the person who submitted it.
--
-- p_author is read out of the URL by the server, never sent by the client. X and
-- TikTok carry the author in the path; Instagram does not, and passes NULL,
-- which means "nothing to compare" rather than "no check needed". Those are
-- caught by the reviewer instead, which is why the queue now shows the
-- registered handle beside every link.
--
-- This is a comparison, not verification. 0002 already says an unverified handle
-- must never be used to attribute an entry, and verified_at is still never set
-- anywhere. So this closes the easy theft, where the thief's own handle has
-- nothing to do with the post, and does not close the harder one, where they
-- registered the victim's handle first. That needs handle verification.

DROP FUNCTION IF EXISTS submit_entry(uuid, uuid, platform, text, boolean);

CREATE FUNCTION submit_entry(
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

-- A rejected submission must not block that platform for the rest of the week.
--
-- submission_one_per_platform was a plain unique index, so a creator whose entry
-- was rejected could never resubmit on that platform, even to fix exactly what
-- the reviewer asked them to fix. The URL index was already made partial on
-- status for the same reason in 0003; this is the half that was missed.
DROP INDEX IF EXISTS "submission_one_per_platform";

CREATE UNIQUE INDEX "submission_one_per_platform_active"
  ON "submissions" ("entry_id", "platform")
  WHERE "status" <> 'rejected';
