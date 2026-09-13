-- Disqualifying a creator takes back the referral they were worth.
--
-- The referral programme pays the referrer when the creator they brought in has
-- their first approved entry. Nothing reversed that payment when the referred
-- creator was disqualified, which left referral farming profitable even when
-- caught: register throwaway accounts, get one entry approved on each, and the
-- referral points survive the bans. On a leaderboard settled in naira, points
-- that survive enforcement are the attack.
--
-- void_enrolment is regenerated from 0022, its latest definition, with the
-- clawback added between the handle release and the audit row. The lineage
-- guard fails the build if this drops a rule 0022 raised.

CREATE OR REPLACE FUNCTION void_enrolment(
  p_enrolment uuid,
  p_admin     uuid,
  p_reason    text
)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_creator  uuid;
  v_campaign uuid;
  v_reason   text := btrim(COALESCE(p_reason, ''));
  n          integer;
  v_ref      record;
  v_take     integer;
  v_reversed integer := 0;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF v_reason = '' THEN
    -- The same rule as every other admin action that takes something away.
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  SELECT creator_id, campaign_id INTO v_creator, v_campaign
    FROM campaign_creators WHERE id = p_enrolment;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  UPDATE campaign_creators
     SET status = 'disqualified'
   WHERE id = p_enrolment;

  UPDATE creator_social_handles
     SET verified_at = NULL
   WHERE creator_id = v_creator
     AND verified_at IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  /*
   * Take back the referral that was paid for bringing this creator in.
   *
   * The programme pays for participation: the referrer is credited when the
   * creator they referred has their first approved entry. When that creator is
   * disqualified, the thing the payment was for is void too, and leaving it
   * standing makes referral farming profitable even when the farmed accounts
   * are caught: register throwaways, get one entry approved on each, keep the
   * referral points after the bans.
   *
   * The unpaid case needs nothing here. Payment happens on first approval, and
   * review() refuses approvals for a voided enrolment, so an unpaid referral
   * can never become payable afterwards.
   *
   * The ledger is append-only, so the reversal is a signed negative row rather
   * than an edit, and the referral row keeps awarded_at: the history of what
   * was paid and then reversed stays readable. The idempotency key makes a
   * second void of the same enrolment a no-op rather than a second deduction.
   *
   * Clamped to what the referrer currently holds. points_total carries a
   * CHECK >= 0, and a referrer who has since had deductions could otherwise
   * make the whole void fail, which would mean a cheat cannot be disqualified
   * because their referrer's balance is low. The note records the clamp.
   */
  FOR v_ref IN
    SELECT r.id AS referral_id,
           r.referrer_campaign_creator_id AS referrer,
           l.points AS paid
      FROM referrals r
      JOIN point_ledger l ON l.id = r.awarded_ledger_id
     WHERE r.referred_campaign_creator_id = p_enrolment
       AND r.awarded_at IS NOT NULL
       AND l.points > 0
  LOOP
    -- The referrer's row lock, then the read the clamp depends on, in that
    -- order, for the same reason recompute_points_total takes it first.
    PERFORM 1 FROM campaign_creators WHERE id = v_ref.referrer FOR UPDATE;

    SELECT LEAST(v_ref.paid, COALESCE(sum(points), 0)) INTO v_take
      FROM point_ledger
     WHERE campaign_creator_id = v_ref.referrer;

    IF v_take > 0 THEN
      BEGIN
        INSERT INTO point_ledger (
          campaign_id, campaign_creator_id, source, points, idempotency_key, note
        ) VALUES (
          v_campaign, v_ref.referrer, 'referral', -v_take,
          'referral_reversal:' || v_ref.referral_id::text,
          CASE WHEN v_take < v_ref.paid
            THEN 'Referral reversed: the referred creator was disqualified. Clamped from '
                 || v_ref.paid || ' to what they held.'
            ELSE 'Referral reversed: the referred creator was disqualified.'
          END
        );
        v_reversed := v_reversed + v_take;
        PERFORM recompute_points_total(v_ref.referrer);
      EXCEPTION
        WHEN unique_violation THEN
          -- Already reversed by an earlier void of this same enrolment.
          NULL;
      END;
    END IF;
  END LOOP;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'enrolment.voided', 'campaign_creator', p_enrolment,
    jsonb_build_object('handles_released', n, 'referral_points_reversed', v_reversed),
    v_reason
  );

  RETURN n;
END $$;
