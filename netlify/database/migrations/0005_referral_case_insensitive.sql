-- Match referral codes without regard to case.
--
-- Codes are minted from an uppercase alphabet with no O, 0, I or 1, chosen so
-- that one can be read aloud over a voice note and typed back correctly. That
-- is exactly the journey this lookup then refused: the join route accepts
-- [A-Za-z0-9_-] and stores whatever arrived, and the comparison was a plain
-- equality, so a code typed in lower case matched nothing.
--
-- The failure was silent and expensive. Registration still succeeded, the
-- creator still got their own code back, and the only thing that did not happen
-- was the referrals row. Nobody was told. The referrer simply never got credit,
-- and the join route's own comment notes that a referral is the one thing that
-- cannot be reconstructed after the fact.
--
-- Every stored code is uppercase by construction, so folding both sides cannot
-- collide two distinct codes into one. code_used is stored folded as well, so
-- it can be joined against referral_code later.

CREATE OR REPLACE FUNCTION register_creator(
  p_campaign_slug   text,
  p_full_name       text,
  p_email           text,
  p_email_canonical text,
  p_phone           text,
  p_phone_e164      text,
  p_niche           text,
  p_audience        integer,
  p_location        text,
  p_x               text,
  p_instagram       text,
  p_tiktok          text,
  p_ref             text,
  p_ip              text,
  p_user_agent      text,
  p_referral_code   text,
  p_rules_version   text
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
    content_niche, audience_size, location, registration_ip, registration_user_agent
  ) VALUES (
    p_full_name, p_email, p_email_canonical, p_phone, p_phone_e164,
    p_niche, p_audience, p_location, p_ip, p_user_agent
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
