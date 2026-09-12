-- Give each enrolment a secret access token, so a creator can prove who they
-- are without an email round trip.
--
-- There is no email provider configured and setting one up needs a verified
-- sending domain and DNS records that nobody can finish today. A creator still
-- has to be able to come back, see their points, find their referral link and,
-- shortly, submit an entry. So registration mints a random token, shows it once
-- and stores only its hash.
--
-- Hashed with SHA-256 rather than bcrypt or argon2, deliberately. Those exist to
-- make guessing a low-entropy secret slow, and a password is low entropy because
-- a person chose it. This token is 32 random bytes: it cannot be guessed at any
-- rate, so a slow hash would buy nothing and cost a serverless function its time
-- budget on every request. What the hash is for is that the database alone is
-- not enough to impersonate a creator.
--
-- Unique so a collision is a constraint violation rather than two creators
-- sharing an identity, which is worth being loud about even though it will not
-- happen at 256 bits.

ALTER TABLE campaign_creators
  ADD COLUMN IF NOT EXISTS access_token_hash text,
  ADD COLUMN IF NOT EXISTS access_token_issued_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_creator_access_token_unique
  ON campaign_creators (access_token_hash)
  WHERE access_token_hash IS NOT NULL;

-- Dropped by its exact signature, not replaced.
--
-- CREATE OR REPLACE matches on name and argument types, so adding a parameter
-- defines a second function beside the first and leaves the old one callable.
-- Here the old one would keep writing enrolments with no access token, and the
-- creator would have no way back in.
DROP FUNCTION IF EXISTS register_creator(
  text, text, text, text, text, text, text, integer, text,
  text, text, text, text, text, text, text, text, boolean, text
);

CREATE FUNCTION register_creator(
  p_campaign_slug     text,
  p_full_name         text,
  p_email             text,
  p_email_canonical   text,
  p_phone             text,
  p_phone_e164        text,
  p_niche             text,
  p_audience          integer,
  p_location          text,
  p_x                 text,
  p_instagram         text,
  p_tiktok            text,
  p_ref               text,
  p_ip                text,
  p_user_agent        text,
  p_referral_code     text,
  p_rules_version     text,
  p_marketing_opt_in  boolean,
  p_privacy_version   text,
  p_access_token_hash text
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
    campaign_id, creator_id, referral_code,
    accepted_rules_version, accepted_rules_at,
    access_token_hash, access_token_issued_at
  ) VALUES (
    v_campaign, v_creator, p_referral_code,
    p_rules_version, now(),
    p_access_token_hash,
    CASE WHEN p_access_token_hash IS NULL THEN NULL ELSE now() END
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
