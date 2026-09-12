-- Let creators submit entries, and give them something to submit to.
--
-- The four challenges come from the stage data already published on the
-- campaign page, so a creator reads the same brief on the site and in the
-- database rather than two descriptions that can drift. Day 1 is 14 September
-- and each stage runs Monday to Sunday, which is what the published day ranges
-- say: 1 to 7, 8 to 14, 15 to 21, and 22 to the end.
--
-- Seeded as 'active' with real windows. submit_entry refuses anything outside
-- the window, so publishing all four now does not open week four early: the
-- dates hold them shut and open them on their own.

INSERT INTO challenges (
  campaign_id, title, description, week_no, stage, status, starts_at, ends_at, base_points
)
SELECT
  c.id, v.title, v.description, v.week_no, v.stage, 'active'::challenge_status,
  v.starts_at::timestamptz, v.ends_at::timestamptz, 100
FROM campaigns c
CROSS JOIN (VALUES
  ('The Discovery', 'Who is Monica? Introduce Monica to your audience and make the brand understandable.',
   1::smallint, 1::smallint, '2026-09-14 00:00:00+01', '2026-09-20 23:59:59+01'),
  ('The Problem', 'Why is money still this complicated? Tell real or relatable stories about financial friction: the fees, the waiting, the rates.',
   2::smallint, 2::smallint, '2026-09-21 00:00:00+01', '2026-09-27 23:59:59+01'),
  ('The Solution', 'There is a better way. Explore stablecoins, digital finance and what Monica is actually building.',
   3::smallint, 3::smallint, '2026-09-28 00:00:00+01', '2026-10-04 23:59:59+01'),
  ('The Money Story', 'Tell Monica''s story your way. Maximum creative freedom, and your strongest single piece of work.',
   4::smallint, 4::smallint, '2026-10-05 00:00:00+01', '2026-10-17 23:59:59+01')
) AS v(title, description, week_no, stage, starts_at, ends_at)
WHERE c.slug = 'monica-money-story'
  AND NOT EXISTS (
    SELECT 1 FROM challenges ch
     WHERE ch.campaign_id = c.id AND ch.week_no = v.week_no
  );

-- One entry per creator per challenge already exists as entry_unique, and one
-- submission per platform per entry as submission_one_per_platform. What is
-- missing is somewhere to do both halves at once.
--
-- A submission needs an entry, and the entry has to exist before the first
-- submission and be reused by the second. Over neon-http, which has no
-- interactive transactions, "look for the entry, create it if missing, then
-- insert the submission" is three round trips with two gaps in it, and two
-- requests arriving inside those gaps both try to create the entry. So it is
-- one function.
--
-- The point rates are read from point_rules and frozen onto the entry at the
-- moment it is created. Changing a rate later moves future entries only, and
-- never rewrites points somebody has already been told they have.

CREATE OR REPLACE FUNCTION submit_entry(
  p_enrolment uuid,
  p_challenge uuid,
  p_platform  platform,
  p_url       text
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

  -- The window is the real gate. A challenge may be 'active' for weeks before
  -- and after its own dates, because all four are published at once.
  IF ch.status <> 'active' THEN
    RAISE EXCEPTION 'challenge_closed' USING ERRCODE = 'P0203';
  END IF;
  IF now() < ch.starts_at THEN
    RAISE EXCEPTION 'challenge_not_open' USING ERRCODE = 'P0204';
  END IF;
  IF now() > ch.ends_at THEN
    RAISE EXCEPTION 'challenge_ended' USING ERRCODE = 'P0205';
  END IF;

  -- An entry has to come from an account the creator registered. The rules say
  -- so, and without this somebody could submit a post from an account nobody
  -- can check belongs to them.
  IF NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator AND platform = p_platform
  ) THEN
    RAISE EXCEPTION 'platform_not_registered' USING ERRCODE = 'P0206';
  END IF;

  -- Lock the enrolment so two submissions racing for the same creator cannot
  -- both decide the entry is missing and both try to create it.
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
      -- Two different collisions, and a creator needs to be told which.
      -- Qualified, because entry_id is also an OUT parameter of this function
      -- and an unqualified reference is ambiguous. Postgres reports that at
      -- call time rather than at definition time, so it surfaces as a failed
      -- submission rather than a failed migration.
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
