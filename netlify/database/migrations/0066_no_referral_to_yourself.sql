/*
 * A referral cannot credit the person registering.
 *
 * register_creator refused self-referral with v_ref_creator <> v_creator.
 * v_creator is the creators row this same call inserts a few statements
 * earlier, so the comparison is false only when the code typed is the code
 * minted for this very registration, which nobody filling in the form can
 * know. A person already holding an enrolment could register a second one
 * with a fresh email and phone, type the first one's code, and have the first
 * enrolment paid the referral rule as soon as the second had an entry
 * approved: once per extra enrolment, with no cap on the referrer.
 *
 * The comparison needed a different identity, and email and phone are not
 * it. A registered email or phone is refused outright before the insert, so
 * neither can ever equal the referrer's, and neither is proven: the access
 * token comes back in the response, so a second enrolment never needs a
 * working inbox or handset. What the campaign scores by is the account a post
 * is attributed to. submit_entry's wrong_account test ties every entry to one
 * of the enrolment's own handle rows, so two enrolments naming the same
 * account on the same platform are one person's work whoever typed the forms,
 * and crediting one for bringing in the other is the self-referral the rules
 * forbid. That is now the test: the referral is not recorded when the
 * newcomer lists any (platform, handle) the referrer's creator holds, with
 * case folded the way wrong_account and 0065 fold it.
 *
 * Deliberately not compared:
 *
 *   registration_ip  carrier NAT puts whole neighbourhoods behind one address,
 *                    and friends signing each other up on the same network
 *                    are exactly the referrals the programme exists to pay.
 *   monica_tag       free text nothing verifies; two people who have no
 *                    Monica account yet can type the same placeholder.
 *   another platform the same name on X and on Instagram can be two people,
 *                    and submit_entry never matches an author across
 *                    platforms either.
 *
 * The registration itself still succeeds, as it does for a code that belongs
 * to nobody or to a voided enrolment. Refusing it would bring back the
 * lock-out 0061 declines at registration: whoever typed a real creator's
 * handle first could stop that creator joining through a friend's link. The
 * only thing withheld is credit that could not be honest.
 *
 * What this cannot reach is a second enrolment on a genuinely separate
 * account. Nothing in the database proves two accounts are one person, so
 * that stays with the reviewer, and voiding the second enrolment claws its
 * referral back (0027, 0063). It is also forward only: a referral recorded
 * before this migration is not re-examined, because moving standings
 * mid-campaign is a decision for an owner looking at the rows, not for a
 * deploy.
 *
 * Regenerated from 0049, its latest definition. Only the guard in front of
 * the referrals insert changed; every raise is kept.
 */

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

    /*
     * Not the same person at both ends. v_creator is the row inserted above,
     * so the first comparison only ever rules out the code minted in this
     * call; the shared account is what recognises somebody who already holds
     * an enrolment. The handle rows written a few lines up are visible here
     * because this is the same transaction. The header says why it is the
     * account and not the email, phone, address or Monica tag.
     */
    IF v_referrer IS NOT NULL
       AND v_ref_creator <> v_creator
       AND NOT EXISTS (
         SELECT 1
           FROM creator_social_handles mine
           JOIN creator_social_handles theirs
             ON theirs.platform = mine.platform
            AND lower(theirs.handle_normalized) = lower(mine.handle_normalized)
          WHERE mine.creator_id = v_creator
            AND theirs.creator_id = v_ref_creator
       ) THEN
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
