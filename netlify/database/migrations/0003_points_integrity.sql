-- Five defects in the built layer, all of which only bite once real money moves.

-- 1. ------------------------------------------------------------------------
-- Approving a submission mints points, and the function did not record who did
-- it. reviewed_by_admin_id existed on the table and was never written, so the
-- single action that decides how ₦5,000,000 is split was anonymous by
-- construction. "Why was this approved, and by whom" had no answer in the data.

-- 2. ------------------------------------------------------------------------
-- campaign_creators.first_approved_at was declared and never written. Leaving a
-- column permanently null is worse than not having it: anything reading it
-- silently gets nothing rather than failing.

-- 3. ------------------------------------------------------------------------
-- The cache was recomputed outside the creator's own lock. Two entries for one
-- creator approved at the same moment each summed the ledger before the other
-- committed, and under READ COMMITTED neither saw the other's row, so one
-- award could vanish from the total while remaining in the ledger. The entry
-- lock does not help: the entries are different rows.

CREATE OR REPLACE FUNCTION recompute_entry_award(p_entry uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_n        smallint;
  v_target   integer;
  v_current  integer;
  v_delta    integer;
  v_cc       uuid;
  v_campaign uuid;
  v_entries  integer;
  e          challenge_entries%ROWTYPE;
BEGIN
  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;

  SELECT campaign_creator_id INTO v_cc FROM challenge_entries WHERE id = p_entry;
  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = v_cc;

  -- Lock the creator too, not just the entry. Two different entries belonging
  -- to one creator are two different rows, so the entry lock lets both through
  -- and both then recompute the same cache from a ledger neither can fully see.
  PERFORM 1 FROM campaign_creators WHERE id = v_cc FOR UPDATE;

  SELECT count(*) INTO v_n FROM submissions
   WHERE entry_id = p_entry AND status = 'approved';

  v_target := CASE
    WHEN v_n = 0 THEN 0
    WHEN v_n = 1 THEN e.base_points_snapshot
    WHEN v_n = 2 THEN e.base_points_snapshot + e.bonus_2_snapshot
    ELSE            e.base_points_snapshot + e.bonus_3_snapshot
  END;

  SELECT COALESCE(sum(points),0) INTO v_current FROM point_ledger
   WHERE entry_id = p_entry AND source = 'challenge_entry';

  v_delta := v_target - v_current;

  IF v_delta <> 0 THEN
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, entry_id)
    VALUES (v_campaign, v_cc, 'challenge_entry', v_delta, p_entry);
  END IF;

  UPDATE challenge_entries
     SET approved_platform_count = v_n, awarded_points = v_target, updated_at = now()
   WHERE id = p_entry;

  SELECT count(*) INTO v_entries FROM challenge_entries
   WHERE campaign_creator_id = v_cc AND approved_platform_count >= 1;

  UPDATE campaign_creators cc SET
    points_total = (SELECT COALESCE(sum(points),0) FROM point_ledger WHERE campaign_creator_id = v_cc),
    approved_entries_count = v_entries,
    -- Earliest wins and is never moved. Losing every approval later does not
    -- change the fact that this is when they first had one.
    first_approved_at = CASE
      WHEN v_entries >= 1 THEN COALESCE(cc.first_approved_at, now())
      ELSE cc.first_approved_at
    END
   WHERE cc.id = v_cc;

  RETURN v_target;
END $$;

-- review() now demands an actor. Not optional: a default would be a way to
-- keep minting points anonymously, and the whole point is that there is no
-- longer such a way.
DROP FUNCTION IF EXISTS review(uuid, submission_status);

CREATE OR REPLACE FUNCTION review(
  p_sub    uuid,
  p_status submission_status,
  p_admin  uuid,
  p_note   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_entry uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  UPDATE submissions
     SET status = p_status,
         reviewed_at = now(),
         reviewed_by_admin_id = p_admin,
         review_note = COALESCE(p_note, review_note)
   WHERE id = p_sub
   RETURNING entry_id INTO v_entry;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM recompute_entry_award(v_entry);
END $$;

-- 4. ------------------------------------------------------------------------
-- A rejected submission held its URL forever, because the uniqueness index
-- ignored status. That let anyone burn a public post URL before its author
-- submitted it: claim it, get rejected, and the real author can never submit
-- their own post. Rejection now releases it.
DROP INDEX IF EXISTS "submission_url_unique";
CREATE UNIQUE INDEX "submission_url_unique_active"
  ON "submissions" ("url")
  WHERE "status" <> 'rejected';

-- 5. ------------------------------------------------------------------------
-- The rules page tells every registrant that "the version in force when you
-- register is recorded against your entry". It was validated and discarded.
-- Since the rules may be amended mid-campaign, "they accepted the rules" is not
-- an answer to a dispute; which wording they accepted is.
ALTER TABLE "campaign_creators"
  ADD COLUMN IF NOT EXISTS "accepted_rules_version" text,
  ADD COLUMN IF NOT EXISTS "accepted_rules_at" timestamp with time zone;

-- 6. ------------------------------------------------------------------------
-- The per-address ceiling counted rows in creators, which means it counted only
-- registrations that SUCCEEDED. Every rejected attempt was free, so the
-- duplicate-detection responses could be probed without limit to learn whether
-- a given email, phone or handle is registered. Attempts are counted now.
--
-- Only the address and the outcome are kept. Recording the email that was tried
-- would build a list of people who are not registered, which is a worse thing
-- to hold than the thing it protects.
CREATE TABLE IF NOT EXISTS "registration_attempts" (
  "id"         bigserial PRIMARY KEY,
  "ip"         text,
  "outcome"    text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "registration_attempts_ip_time"
  ON "registration_attempts" ("ip", "created_at" DESC);

COMMENT ON TABLE "registration_attempts" IS
  'Rate limiting only. Deliberately holds no identifier of who was attempted: a list of addresses that are NOT registered is worse to hold than what it protects.';

-- register_creator gains the accepted rules version.
DROP FUNCTION IF EXISTS register_creator(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text);

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
     WHERE cc.campaign_id = v_campaign AND cc.referral_code = p_ref;

    IF v_referrer IS NOT NULL AND v_ref_creator <> v_creator THEN
      INSERT INTO referrals (
        campaign_id, referrer_campaign_creator_id, referred_campaign_creator_id, code_used
      ) VALUES (v_campaign, v_referrer, v_enrolment, p_ref);
    END IF;
  END IF;

  RETURN QUERY SELECT v_enrolment, p_referral_code, p_full_name;
END $$;
