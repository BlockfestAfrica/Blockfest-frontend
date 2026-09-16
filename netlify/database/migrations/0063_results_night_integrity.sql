/*
 * Four holes on the results-night path, found by auditing the code that has
 * never run against a real campaign.
 *
 * Every function here is reproduced from its highest-numbered definition and
 * edited, because only the newest body is live and a partial copy would
 * silently drop whatever the versions in between added.
 *
 * ---------------------------------------------------------------------------
 * 1. A disqualified creator's referral was paid a second time.
 *
 * recompute_entry_award decides whether to pay by netting the referral's own
 * ledger rows. A clawback makes that net zero, which reads identically to
 * "never paid". So any later recompute on a voided creator's entry paid the
 * referrer again, and rejecting their leftover pending work is enough to
 * cause it, which 0024 explicitly permits a reviewer to do while clearing a
 * queue.
 *
 * Nothing could take it back. void_enrolment wrote its reversal under an
 * unsuffixed key, so a second void collided on ledger_idempotency_key and
 * reported success having done nothing, and award_points refuses
 * source = 'referral' with P0501. The points simply stayed on a leaderboard
 * that settles a one and a half million naira prize.
 *
 * Fixed on both sides: the pay branch now asks whether the referred creator
 * is still in the campaign, and the reversal nets what is outstanding instead
 * of replaying what was once paid, so it is idempotent by arithmetic rather
 * than by key collision.
 *
 * ---------------------------------------------------------------------------
 * 2. A drafted Creator of the Week vanished from her own candidate list.
 *
 * weekly_winner_candidates excludes anyone who has already won that category,
 * and weekly_winners holds drafts and published rows in one table. So saving
 * a draft removed that creator from the list the announce step picks from,
 * and the console reported her missing with "they have already been Creator
 * of the Week" about somebody who has won nothing. At eight on a Sunday that
 * invites announcing the next name down.
 *
 * ---------------------------------------------------------------------------
 * 3. A tie-break basis of NULL could be re-based after the vote ended.
 *
 * close_vote_round pinned max(version) and 0059 reasoned a NULL pin was safe
 * because announcing refuses an unfrozen week anyway. The freeze can arrive
 * between the two. Close with no snapshot, record the standings to satisfy
 * P0804, and the fallback resolves the pin to a board taken after voting
 * finished. The basis is now required at the close instead.
 *
 * The COALESCE fallback in publish_weekly_winner is deliberately left where
 * it is. With this guard no new NULL pin can be written and no round has ever
 * been closed in production, so it is unreachable rather than wrong, and
 * regenerating that function to delete dead code would put the one
 * irreversible operation in the campaign into a migration that does not need
 * to touch it.
 */

-- 1. Do not pay a referral for a creator who is no longer in the campaign.
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
  v_was_approved_before boolean;
  v_referral referrals%ROWTYPE;
  v_referral_points integer;
  v_ledger_id uuid;
  e          challenge_entries%ROWTYPE;
BEGIN
  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;

  SELECT campaign_creator_id INTO v_cc FROM challenge_entries WHERE id = p_entry;
  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = v_cc;

  PERFORM 1 FROM campaign_creators WHERE id = v_cc FOR UPDATE;

  -- Captured before the update below, because the whole referral question is
  -- whether this approval is the creator's first.
  SELECT first_approved_at IS NOT NULL INTO v_was_approved_before
    FROM campaign_creators WHERE id = v_cc;

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
    first_approved_at = CASE
      WHEN v_entries >= 1 THEN COALESCE(cc.first_approved_at, now())
      ELSE cc.first_approved_at
    END
   WHERE cc.id = v_cc;

  -- ---------------------------------------------------------------------
  -- The referral, kept true to the approvals rather than paid on a latch.
  --
  -- The old gate fired only on the transition into first approval, which
  -- broke its own promises twice over: a zero rate at that exact moment
  -- forfeited the referral forever, against the "stays payable" comment,
  -- and a rejection that took the creator back to zero approvals left the
  -- referrer paid for work that no longer exists, against 0027's own
  -- rationale for the clawback. Both directions now reconcile on every
  -- recompute from what the ledger nets for THIS referral: pay when the
  -- creator stands approved and nothing is paid, reverse when they stand
  -- unapproved and something is. The referrals row lock serialises racing
  -- approvals; suffixed idempotency keys let a reverse-then-reinstate
  -- cycle land exactly once per swing while old unsuffixed rows count in
  -- the net. Mutual referrer cycles cannot exist (codes are minted at
  -- registration and self-referral is refused), so the referrer lock
  -- taken inside cannot deadlock against another recompute.
  SELECT * INTO v_referral FROM referrals
   WHERE referred_campaign_creator_id = v_cc
   FOR UPDATE;

  IF v_referral.id IS NOT NULL THEN
    DECLARE
      v_net  integer;
      v_take integer;
      v_seq  integer;
      v_hold integer;
      v_referred_status enrollment_status;
    BEGIN
      /*
       * Whether the creator this referral was for is still in the campaign.
       *
       * Without it the pay branch below reads only the NET of the referral
       * ledger rows, and a clawback makes that net zero. So any later
       * recompute on a disqualified creator's entry saw "referred creator
       * has an approved entry, nothing outstanding" and paid the referrer
       * a second time. Rejecting their leftover pending work is enough to
       * trigger it, and 0024 explicitly allows exactly that.
       */
      SELECT COALESCE(status, 'active') INTO v_referred_status
        FROM campaign_creators WHERE id = v_cc;
      SELECT COALESCE(sum(points), 0), count(*)
        INTO v_net, v_seq
        FROM point_ledger
       WHERE campaign_creator_id = v_referral.referrer_campaign_creator_id
         AND source = 'referral'
         AND (idempotency_key = 'referral:' || v_referral.id::text
              OR idempotency_key LIKE 'referral:' || v_referral.id::text || ':%'
              OR idempotency_key = 'referral_reversal:' || v_referral.id::text
              OR idempotency_key LIKE 'referral_reversal:' || v_referral.id::text || ':%');

      SELECT COALESCE(default_points, 0) INTO v_referral_points
        FROM point_rules
       WHERE campaign_id = v_campaign AND key = 'referral';

      IF v_entries >= 1 AND v_net = 0 AND COALESCE(v_referral_points, 0) > 0
         AND v_referred_status <> 'disqualified' THEN
        INSERT INTO point_ledger (
          campaign_id, campaign_creator_id, source, points, idempotency_key, note
        ) VALUES (
          v_campaign,
          v_referral.referrer_campaign_creator_id,
          'referral',
          v_referral_points,
          'referral:' || v_referral.id::text || CASE WHEN v_seq = 0 THEN '' ELSE ':' || v_seq::text END,
          'Referred creator had their first approved entry.'
        )
        RETURNING id INTO v_ledger_id;

        UPDATE referrals
           SET awarded_at = now(), awarded_ledger_id = v_ledger_id
         WHERE id = v_referral.id;
        PERFORM recompute_points_total(v_referral.referrer_campaign_creator_id);

      ELSIF v_entries = 0 AND v_net > 0 THEN
        -- Clamped exactly as 0027 clamps: the referrer may hold less than
        -- was paid, and a reversal must not fail on the non-negative CHECK.
        PERFORM 1 FROM campaign_creators
         WHERE id = v_referral.referrer_campaign_creator_id FOR UPDATE;
        SELECT points_total INTO v_hold FROM campaign_creators
         WHERE id = v_referral.referrer_campaign_creator_id;
        v_take := LEAST(v_net, GREATEST(v_hold, 0));

        IF v_take > 0 THEN
          INSERT INTO point_ledger (
            campaign_id, campaign_creator_id, source, points, idempotency_key, note
          ) VALUES (
            v_campaign,
            v_referral.referrer_campaign_creator_id,
            'referral',
            -v_take,
            'referral_reversal:' || v_referral.id::text || ':' || v_seq::text,
            'Referred creator no longer has an approved entry.'
          );
        END IF;

        -- Payable again if the approvals return; the CHECK wants the pair
        -- together, so both clear.
        UPDATE referrals
           SET awarded_at = NULL, awarded_ledger_id = NULL
         WHERE id = v_referral.id;
        PERFORM recompute_points_total(v_referral.referrer_campaign_creator_id);
      END IF;
    END;
  END IF;

  RETURN v_target;
END $$;

-- 2. Take back what is outstanding, and stay reversible if it is re-paid.
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
               AND (pl.idempotency_key = 'referral_reversal:' || r.id::text
                    OR pl.idempotency_key LIKE 'referral_reversal:' || r.id::text || ':%')
           ) AS reversals
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
          'referral_reversal:' || v_ref.referral_id::text
            || CASE WHEN v_ref.reversals = 0
                 THEN '' ELSE ':' || v_ref.reversals::text END,
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
          -- Two voids racing on one referral. The sequence above makes the
          -- ordinary repeat arithmetic rather than a collision, so reaching
          -- here means another transaction got there first, and its row is
          -- the one that stands.
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

-- 3. A draft is not a win, so it must not exclude its own creator.
CREATE OR REPLACE FUNCTION weekly_winner_candidates(
  p_campaign_slug text,
  p_category      winner_category
)
RETURNS TABLE (
  campaign_creator_id uuid,
  display_name        text,
  points_total        integer,
  approved_entries    integer,
  rank                bigint
)
LANGUAGE sql STABLE AS $$
  SELECT r.campaign_creator_id, r.display_name, r.points_total,
         r.approved_entries, r.rank
    FROM campaign_ranked(p_campaign_slug) r
   WHERE p_category <> 'creator_of_week'
      OR NOT EXISTS (
        SELECT 1
          FROM weekly_winners w
          JOIN campaigns c ON c.id = w.campaign_id
         WHERE c.slug = p_campaign_slug
           AND w.category = 'creator_of_week'
           AND w.published_at IS NOT NULL
           AND w.campaign_creator_id = r.campaign_creator_id
      )
   ORDER BY r.rank;
$$;

-- 4. No tie-break basis, no close.
CREATE OR REPLACE FUNCTION close_vote_round(p_admin uuid, p_round uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r vote_rounds%ROWTYPE;
  v_version smallint;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status <> 'open' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;

  /*
   * The standings as they stand at the close become the tie-break basis,
   * for good.
   *
   * 0059 reasoned that a NULL pin was harmless because the announce gate
   * refuses an unfrozen week separately. It is not, because the freeze can
   * arrive between the two: close on Sunday with no snapshot, pin NULL,
   * record the standings to satisfy P0804, and the COALESCE fallback then
   * resolves the pin to whichever snapshot was taken AFTER the vote ended.
   * A tie settled by the board at the close would be re-settled by a board
   * that did not exist yet, and "Record the standings" is a button the
   * console truthfully describes as losing nothing.
   *
   * So the basis is required at the close rather than repaired later. This
   * makes the ordering explicit: record the standings, then close the
   * round. It is a refusal a reviewer can act on, which a silent re-basing
   * is not.
   */
  SELECT max(version) INTO v_version
    FROM leaderboard_snapshots
   WHERE campaign_id = r.campaign_id AND week_no = r.week_no;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'week_not_frozen' USING ERRCODE = 'P0804';
  END IF;

  UPDATE vote_rounds
     SET status = 'closed', tiebreak_snapshot_version = v_version
   WHERE id = p_round;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
  VALUES (r.campaign_id, p_admin, 'vote_round.closed', 'vote_round', p_round,
          jsonb_build_object('tiebreak_snapshot_version', v_version));
END $$;
