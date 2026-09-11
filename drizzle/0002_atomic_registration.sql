-- Registration in one transaction, and handles that can be claimed but not squatted.
--
-- Two problems, both of which only appear once real people are registering.
--
-- First: the neon-http driver has no interactive transactions, so registering a
-- creator was four independent commits. When the second one violated the handle
-- uniqueness constraint the first had already committed, leaving a creators row
-- holding an email and phone number with no enrolment attached and no way to
-- release them. Submitting somebody else's email address together with a handle
-- already taken was enough to stop that person ever registering, and the error
-- they would be shown said their email was already registered, which was true
-- and which they could do nothing about. A plpgsql body runs inside a single
-- implicit transaction, so moving the whole thing here makes it all-or-nothing
-- in one round trip.
--
-- Second: handles were claimed first-come-first-served and permanently. Nothing
-- checked that the person registering controlled the account, so the handles of
-- well-known creators could be taken in bulk, which both blocks those creators
-- from entering and, once submission intake resolves a pasted URL back through
-- this table, would credit their published work to whoever holds the row.
-- Verification is a separate piece of work; what this migration does is stop a
-- claim being permanent, so the exclusivity belongs to a verified handle rather
-- than to whoever typed it first.

ALTER TABLE "creator_social_handles"
  ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;

COMMENT ON COLUMN "creator_social_handles"."verified_at" IS
  'When ownership of this account was proven. Null means claimed but unproven: it may collide with other unverified claims and must never be used to attribute an entry.';

-- Exclusivity now belongs to proven ownership. Two people may both claim an
-- unverified handle; at most one of them can ever verify it.
DROP INDEX IF EXISTS "social_handle_unique";
CREATE UNIQUE INDEX "social_handle_unique_verified"
  ON "creator_social_handles" ("platform", "handle_normalized")
  WHERE "verified_at" IS NOT NULL;

-- Still one row per creator per platform, verified or not.
-- (social_handle_one_per_creator_platform is unchanged.)

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
  p_referral_code   text
)
RETURNS TABLE (campaign_creator_id uuid, referral_code text, full_name text)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign  uuid;
  v_starts_at timestamptz;
  v_status    campaign_status;
  v_creator   uuid;
  v_enrolment uuid;
  v_referrer  uuid;
  v_ref_creator uuid;
BEGIN
  SELECT id, starts_at, status INTO v_campaign, v_starts_at, v_status
    FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Errors are raised with distinct codes so the endpoint can name the field a
  -- person needs to change, without parsing constraint names out of a message.
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

  -- Claimed, not proven. Colliding with an existing unverified claim is allowed
  -- precisely so that a squatter cannot lock the real owner out.
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

  INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
  VALUES (v_campaign, v_creator, p_referral_code)
  RETURNING id INTO v_enrolment;

  -- An unknown or self-referring code is dropped rather than rejected: the
  -- person registering did nothing wrong and should not be stopped by someone
  -- else's bad link, or by their own.
  IF p_ref IS NOT NULL AND p_ref <> '' THEN
    SELECT cc.id, cc.creator_id INTO v_referrer, v_ref_creator
      FROM campaign_creators cc
     WHERE cc.campaign_id = v_campaign AND cc.referral_code = p_ref;

    IF v_referrer IS NOT NULL AND v_ref_creator <> v_creator THEN
      INSERT INTO referrals (
        campaign_id, referrer_campaign_creator_id, referred_campaign_creator_id, code_used
      ) VALUES (v_campaign, v_referrer, v_enrolment, p_ref);
    END IF;
  END IF;

  RETURN QUERY SELECT v_enrolment, p_referral_code, p_full_name;
END $$;

COMMENT ON FUNCTION register_creator IS
  'Registers a creator and their enrolment atomically. Raises P0101 (email taken), P0102 (phone taken) or P0002 (no such campaign); every one of those rolls back the whole registration.';
