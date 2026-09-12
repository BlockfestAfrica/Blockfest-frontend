-- Record marketing consent separately from the campaign itself.
--
-- Registering is an agreement to run an entry: the details are needed to judge
-- it, rank a leaderboard and pay a prize. Hearing about future campaigns is a
-- different purpose and cannot ride on that agreement, so it is asked for
-- separately, defaults to false, and refusing it changes nothing about the
-- entry. Keeping the two apart is what lets the campaign's own basis stay clean
-- whether or not anybody opts in.
--
-- Stored on creators rather than campaign_creators because it is a fact about a
-- person that outlives this campaign, which is the entire point of asking.
--
-- privacy_notice_version records which notice was in force, for the same reason
-- the rules version is recorded: the notice can be amended, and "they were told"
-- is not an answer without knowing what they were told.

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS privacy_notice_version text;

-- A timestamp only where consent was actually given. Proving when somebody
-- opted in is the thing that matters; there is no such moment for a false.
ALTER TABLE creators
  DROP CONSTRAINT IF EXISTS creators_marketing_consent_timed;

ALTER TABLE creators
  ADD CONSTRAINT creators_marketing_consent_timed
  CHECK (
    (marketing_opt_in = true  AND marketing_opt_in_at IS NOT NULL) OR
    (marketing_opt_in = false AND marketing_opt_in_at IS NULL)
  );

-- Dropped by its exact signature rather than replaced.
--
-- CREATE OR REPLACE matches on name AND argument types, so adding two
-- parameters would define a second function beside the first rather than
-- replacing it. Both would then be callable, and the old one would silently
-- keep writing registrations that record no consent at all.
DROP FUNCTION IF EXISTS register_creator(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text
);

CREATE FUNCTION register_creator(
  p_campaign_slug    text,
  p_full_name        text,
  p_email            text,
  p_email_canonical  text,
  p_phone            text,
  p_phone_e164       text,
  p_niche            text,
  p_audience         integer,
  p_location         text,
  p_x                text,
  p_instagram        text,
  p_tiktok           text,
  p_ref              text,
  p_ip               text,
  p_user_agent       text,
  p_referral_code    text,
  p_rules_version    text,
  p_marketing_opt_in boolean,
  p_privacy_version  text
)
RETURNS TABLE (campaign_creator_id uuid, referral_code text, full_name text)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign  uuid;
  v_creator   uuid;
  v_enrolment uuid;
  v_referrer  uuid;
  v_ref_creator uuid;
BEGIN
  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM creators WHERE email_canonical = p_email_canonical) THEN
    RAISE EXCEPTION 'email_taken' USING ERRCODE = 'P0101';
  END IF;
  IF EXISTS (SELECT 1 FROM creators WHERE phone_e164 = p_phone_e164) THEN
    RAISE EXCEPTION 'phone_taken' USING ERRCODE = 'P0102';
  END IF;

  INSERT INTO creators (
    full_name, email, email_canonical, phone, phone_e164,
    content_niche, audience_size, location, registration_ip, registration_user_agent,
    marketing_opt_in, marketing_opt_in_at, privacy_notice_version
  ) VALUES (
    p_full_name, p_email, p_email_canonical, p_phone, p_phone_e164,
    p_niche, p_audience, p_location, p_ip, p_user_agent,
    COALESCE(p_marketing_opt_in, false),
    CASE WHEN COALESCE(p_marketing_opt_in, false) THEN now() ELSE NULL END,
    p_privacy_version
  ) RETURNING id INTO v_creator;

  IF p_x IS NOT NULL AND p_x <> '' THEN
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
    VALUES (v_creator, 'x', p_x, p_x);
  END IF;
  IF p_instagram IS NOT NULL AND p_instagram <> '' THEN
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
    VALUES (v_creator, 'instagram', p_instagram, p_instagram);
  END IF;
  IF p_tiktok IS NOT NULL AND p_tiktok <> '' THEN
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
    VALUES (v_creator, 'tiktok', p_tiktok, p_tiktok);
  END IF;

  INSERT INTO campaign_creators (
    campaign_id, creator_id, referral_code, accepted_rules_version, accepted_rules_at
  ) VALUES (
    v_campaign, v_creator, p_referral_code, p_rules_version, now()
  ) RETURNING id INTO v_enrolment;

  IF p_ref IS NOT NULL AND p_ref <> '' THEN
    SELECT cc.id, cc.creator_id INTO v_referrer, v_ref_creator
      FROM campaign_creators cc
     WHERE cc.campaign_id = v_campaign
       AND upper(cc.referral_code) = upper(p_ref);

    IF v_referrer IS NOT NULL AND v_ref_creator <> v_creator THEN
      INSERT INTO referrals (
        campaign_id, referrer_campaign_creator_id, referred_campaign_creator_id, code_used
      ) VALUES (v_campaign, v_referrer, v_enrolment, upper(p_ref));
    END IF;
  END IF;

  RETURN QUERY SELECT v_enrolment, p_referral_code, p_full_name;
END $$;
