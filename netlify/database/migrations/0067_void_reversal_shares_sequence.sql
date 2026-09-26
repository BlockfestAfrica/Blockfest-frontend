/*
 * A disqualification could leave a re-paid referral standing.
 *
 * Found by the security audit of 0063's clawback. Two functions write
 * 'referral_reversal:<referral id>:n' keys into the one global
 * ledger_idempotency_key, and they counted n differently.
 * recompute_entry_award suffixes every referral row it writes with the
 * number of rows, payments and reversals together, the referral already
 * has. void_enrolment suffixed its reversal with the number of reversals
 * alone.
 *
 * Approve a referred creator, reject their only approved work, approve
 * again, then disqualify them. The rejection wrote 'referral_reversal:<id>:1'
 * (one payment before it) and the re-approval paid under 'referral:<id>:2'.
 * The void found the full referral outstanding, counted one reversal, and
 * built ':1' again. The index refused it, and the unique_violation handler,
 * written for two voids racing, took the refusal for the other void having
 * won. Nothing was reversed, the audit row said referral_points_reversed 0,
 * the referrer was sent no notice, and the points stayed on the board that
 * settles the prize. Voiding again rebuilt the same key and collided the
 * same way, and award_points refuses source = 'referral', so the console
 * had no way back. The flip that starts it is an approved submission
 * rejected, which two reviewers on one stale queue produce, and which the
 * decided page documents as the way to change a decision.
 *
 * Two edits, both inside void_enrolment, reproduced from 0063 (its
 * highest-numbered definition). recompute_entry_award is untouched.
 *
 *   - The reversal key is the one recompute_entry_award builds: suffixed
 *     with the count of every row the referral has in the ledger. Each
 *     write under either prefix adds one row to that count, so the number
 *     a void takes now is above every suffix already written. Recompute's
 *     were each the count before its own row, and the old void suffixes
 *     counted reversals only, which is always fewer than the rows that
 *     existed when they were written, because something had been paid.
 *     Rows written before this migration cannot collide with rows written
 *     after it, and rows written after it cannot collide with each other.
 *
 *   - The handler swallows a collision only when a fresh read finds nothing
 *     left outstanding, which is what a void that got there first leaves.
 *     A collision with points still standing is a numbering fault, and it
 *     now fails the void out loud instead of reporting a clawback that did
 *     not happen. A failed void is an error the owner sees and can retry;
 *     a silent one is points on a prize board nobody knows to look at.
 *
 * A referral already caught by this keeps its points until its creator is
 * voided again. The same enrolment voided after this migration finds the
 * amount outstanding, numbers past the stale key, and takes it back.
 */

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
  v_left     integer;
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
  /*
   * Reverse what is OUTSTANDING, not what was once paid.
   *
   * The old version read the original award row and wrote a reversal under
   * an unsuffixed key, so a second void of the same enrolment collided on
   * ledger_idempotency_key and was swallowed as "already reversed". That
   * was correct while a referral could only be paid once. It stopped being
   * correct the moment a re-payment was possible: the clawback zeroed the
   * net, the net was what the pay branch tested, and a later recompute paid
   * again. The console then had no way back at all, since award_points
   * refuses source = 'referral' outright.
   *
   * Netting the referral's own ledger rows makes this idempotent by
   * arithmetic rather than by key collision: nothing outstanding reverses
   * nothing, and a re-payment is reversible because the key carries a
   * sequence the way the payment side already does.
   *
   * The same sequence, not a parallel one. seq counts the rows
   * recompute_entry_award nets, payments and reversals together, and the
   * suffix is that count, as recompute's is. 0063 counted reversals alone,
   * which reproduced a suffix recompute had already written whenever it
   * had reversed an odd number of times.
   */
  FOR v_ref IN
    SELECT r.id AS referral_id,
           r.referrer_campaign_creator_id AS referrer,
           (SELECT COALESCE(sum(pl.points), 0)
              FROM point_ledger pl
             WHERE pl.campaign_creator_id = r.referrer_campaign_creator_id
               AND pl.source = 'referral'
               AND (pl.idempotency_key = 'referral:' || r.id::text
                    OR pl.idempotency_key LIKE 'referral:' || r.id::text || ':%'
                    OR pl.idempotency_key = 'referral_reversal:' || r.id::text
                    OR pl.idempotency_key LIKE 'referral_reversal:' || r.id::text || ':%')
           ) AS outstanding,
           (SELECT count(*)
              FROM point_ledger pl
             WHERE pl.campaign_creator_id = r.referrer_campaign_creator_id
               AND pl.source = 'referral'
               AND (pl.idempotency_key = 'referral:' || r.id::text
                    OR pl.idempotency_key LIKE 'referral:' || r.id::text || ':%'
                    OR pl.idempotency_key = 'referral_reversal:' || r.id::text
                    OR pl.idempotency_key LIKE 'referral_reversal:' || r.id::text || ':%')
           ) AS seq
      FROM referrals r
     WHERE r.referred_campaign_creator_id = p_enrolment
       AND r.awarded_at IS NOT NULL
  LOOP
    -- Nothing standing means nothing to take back, which is what a repeat
    -- void of an unchanged enrolment now finds.
    CONTINUE WHEN COALESCE(v_ref.outstanding, 0) <= 0;
    -- The referrer's row lock, then the read the clamp depends on, in that
    -- order, for the same reason recompute_points_total takes it first.
    PERFORM 1 FROM campaign_creators WHERE id = v_ref.referrer FOR UPDATE;

    SELECT LEAST(v_ref.outstanding, COALESCE(sum(points), 0)) INTO v_take
      FROM point_ledger
     WHERE campaign_creator_id = v_ref.referrer;

    IF v_take > 0 THEN
      BEGIN
        INSERT INTO point_ledger (
          campaign_id, campaign_creator_id, source, points, idempotency_key, note
        ) VALUES (
          v_campaign, v_ref.referrer, 'referral', -v_take,
          'referral_reversal:' || v_ref.referral_id::text || ':' || v_ref.seq::text,
          CASE WHEN v_take < v_ref.outstanding
            THEN 'Referral reversed: the referred creator was disqualified. Clamped from '
                 || v_ref.outstanding || ' to what they held.'
            ELSE 'Referral reversed: the referred creator was disqualified.'
          END
        );
        v_reversed := v_reversed + v_take;
        PERFORM recompute_points_total(v_ref.referrer);
      EXCEPTION
        WHEN unique_violation THEN
          /*
           * Only a void that already took it back may be swallowed here.
           *
           * The UPDATE above holds this enrolment's row, and
           * recompute_entry_award locks the same row before it reads the
           * referral, so a second void or a racing recompute queues and
           * then reads this one's rows. Reaching here with points still
           * outstanding therefore means the key was stale, which is exactly
           * what 0063 hid by swallowing every collision. Read again and
           * re-raise unless nothing is left.
           */
          SELECT COALESCE(sum(points), 0) INTO v_left
            FROM point_ledger
           WHERE campaign_creator_id = v_ref.referrer
             AND source = 'referral'
             AND (idempotency_key = 'referral:' || v_ref.referral_id::text
                  OR idempotency_key LIKE 'referral:' || v_ref.referral_id::text || ':%'
                  OR idempotency_key = 'referral_reversal:' || v_ref.referral_id::text
                  OR idempotency_key LIKE 'referral_reversal:' || v_ref.referral_id::text || ':%');
          IF v_left > 0 THEN
            RAISE;
          END IF;
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
