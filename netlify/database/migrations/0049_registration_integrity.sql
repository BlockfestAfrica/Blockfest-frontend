-- Registration integrity, from the day-one audit.
--
-- Numbered 0049, renamed from 0044 before it was ever applied. The
-- winners-integrity PR carrying 0045 merged before the PRs carrying 0043
-- and 0044, the database moved to version 45, and both lower numbers
-- became permanently out of order; 0043 became 0047 in the first repair
-- and this is the second. Only never-applied migrations may be renamed.
--
-- register_creator regenerated from 0032, its latest definition, with two
-- changes and everything else verbatim:
--
-- 1. The referrer lookup requires an active enrolment. A creator voided
--    for fraud kept attracting referrals on their old code, and pending
--    ones were still paid; now the code of a voided enrolment simply does
--    not resolve, the same as a code that never existed.
--
-- 2. Two registrations racing with the same email or phone both passed the
--    pre-checks, and the loser's unique_violation surfaced as a 500. The
--    violation is now caught and re-raised as the same named email_taken or
--    phone_taken the fast path uses, so the racer sees the field error the
--    first time.

CREATE OR REPLACE FUNCTION register_creator(
  p_campaign_slug     text,
  p_full_name         text,
  p_email             text,
  p_email_canonical   text,
  p_phone             text,
  p_phone_e164        text,
  p_monica_tag        text,
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
    monica_tag, audience_size, location, registration_ip, registration_user_agent,
    marketing_opt_in, marketing_opt_in_at, privacy_notice_version
  ) VALUES (
    p_full_name, p_email, p_email_canonical, p_phone, p_phone_e164,
    p_monica_tag, p_audience, p_location, p_ip, p_user_agent,
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
    -- A voided enrolment stops attracting referrals: a code that pays its
    -- owner nothing should not silently swallow the credit either.
    SELECT cc.id, cc.creator_id INTO v_referrer, v_ref_creator
      FROM campaign_creators cc
     WHERE cc.campaign_id = v_campaign
       AND cc.status = 'active'
       AND upper(cc.referral_code) = upper(p_ref);

    IF v_referrer IS NOT NULL AND v_ref_creator <> v_creator THEN
      INSERT INTO referrals (
        campaign_id, referrer_campaign_creator_id, referred_campaign_creator_id, code_used
      ) VALUES (v_campaign, v_referrer, v_enrolment, upper(p_ref));
    END IF;
  END IF;

  RETURN QUERY SELECT v_enrolment, p_referral_code, p_full_name;
EXCEPTION
  WHEN unique_violation THEN
    /*
     * Two registrations racing with the same identity: the pre-checks both
     * passed before either inserted, and the loser used to surface as a
     * bare unique_violation the route maps to a 500. The person retries
     * and hits the fast-path email_taken, so the truth was always going to
     * reach them; this answers with it the first time.
     */
    DECLARE v_constraint text;
    BEGIN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint LIKE '%email%' THEN
        RAISE EXCEPTION 'email_taken' USING ERRCODE = 'P0101';
      ELSIF v_constraint LIKE '%phone%' THEN
        RAISE EXCEPTION 'phone_taken' USING ERRCODE = 'P0102';
      END IF;
      RAISE;
    END;
END $$;
