-- The Monica tag replaces the content niche on the registration form.
--
-- content_niche asked "what do you make?" and nothing ever read the answer
-- back: it was written once at registration and appears in no screen, no
-- export and no query. It was a required field that cost every creator a
-- keystroke and told us nothing we acted on.
--
-- The Monica tag is the opposite: it is the creator's username on Monica, and
-- it is how prize money reaches them. A campaign that pays five million naira
-- has to know where each prize goes, and asking for it at registration is far
-- better than asking a winner for it afterwards, when they may have gone quiet
-- and the money is already committed to a named person.
--
-- Nullable at the database level and required by the form, which is the same
-- shape every other optional-in-schema, required-in-practice column here uses.
-- Existing rows predate the field and cannot be made to have one, and a NOT
-- NULL with a placeholder default would mean "we have their tag" for creators
-- whose tag we do not have. That distinction is the whole value of the column.
--
-- content_niche becomes nullable rather than being dropped. Dropping it would
-- destroy what the creators who registered before this did tell us, and the
-- column costs nothing to keep.

ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "monica_tag" text;

ALTER TABLE "creators" ALTER COLUMN "content_niche" DROP NOT NULL;

-- Trimmed and stored as given. Not lowercased: a tag is displayed back to the
-- creator on their own page and to whoever pays them, and changing its case is
-- a small way of getting somebody's name wrong.
ALTER TABLE "creators"
  ADD CONSTRAINT "monica_tag_shape"
  CHECK ("monica_tag" IS NULL OR "monica_tag" ~ '^[A-Za-z0-9._-]{2,40}$');


-- ---------------------------------------------------------------------------
-- register_creator writes the tag where the niche used to go.
--
-- Regenerated from 0007, its latest definition, with one parameter renamed and
-- one column changed. DROP then CREATE, not CREATE OR REPLACE, because Postgres
-- refuses to rename an input parameter in place, which is the same reason 0007
-- itself is written this way.
--
-- The argument list is unchanged in length, types and order, so every existing
-- caller keeps working: only the name of the seventh parameter and the column
-- it lands in are different. The lineage guard fails the build if this drops a
-- rule 0007 raised.

-- The signature as it is TODAY, which is not the one 0007's own DROP names:
-- that DROP targeted the nineteen-argument version 0007 was replacing, and
-- 0007 then created a twenty-argument one. Copying it verbatim dropped nothing
-- and the CREATE below failed with "already exists with same argument types".
DROP FUNCTION IF EXISTS register_creator(
  text, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, text, text, boolean, text, text
);

CREATE FUNCTION register_creator(
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
