-- Say which collision actually happened.
--
-- submit_entry catches unique_violation and then decides which of two unique
-- indexes fired, so it can tell the creator something useful. It decided with
-- an EXISTS that had no status filter, and both candidates are partial on
-- status <> 'rejected': submission_one_per_platform_active from 0011 and
-- submission_url_unique_active from 0003.
--
-- So once a creator has a rejected entry on a platform, that EXISTS is true
-- forever. If they then paste a URL somebody else already submitted, the real
-- collision is the URL index, but the handler sees the old rejected row and
-- says "You have already submitted on that platform". They have not, and they
-- can: 0011 exists precisely so they can. The message sends them away from the
-- fix and into a dead end.
--
-- Same blind spot as the page bug where a rejected entry removed its own
-- platform from the dropdown. The database makes rejected rows invisible to
-- these constraints, so anything reasoning about the constraints has to make
-- them invisible too.
--
-- The body below is 0011's, copied verbatim with that one condition changed.
-- Nothing else about the function moves, including its signature: an earlier
-- attempt rewrote it from memory and got the return columns wrong, which
-- Postgres refuses outright and which would have been far worse if it had not.

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
