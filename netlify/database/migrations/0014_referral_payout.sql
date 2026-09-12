-- Credit a referrer when the creator they brought in is first approved.
--
-- The rules say: "You receive a link that brings other creators into the
-- campaign. Points are credited when the creator you referred has their first
-- approved entry, not when they register." The FAQ repeats it.
--
-- Nothing has ever credited anybody. The referrals table records who brought
-- whom, and has carried awarded_ledger_id and awarded_at with a consistency
-- CHECK since the first migration, so the shape was designed and then never
-- filled in. The ledger even exempts source = 'referral' from the rule that a
-- manual award names an admin, which only makes sense if something automatic
-- was meant to write one.
--
-- The trigger is the moment first_approved_at goes from null to a time, which
-- is exactly "their first approved entry" and is already computed here. Awarding
-- on registration instead would pay for signups rather than for participation,
-- which is what the rule is carefully worded to avoid.
--
-- Idempotent twice over. referrals.awarded_at is checked and set in the same
-- statement, and the ledger row carries an idempotency key unique to that
-- referral, so a replay cannot pay twice even if the guard is somehow passed.

INSERT INTO point_rules (campaign_id, key, default_points)
SELECT c.id, 'referral', 50
  FROM campaigns c
 WHERE c.slug = 'monica-money-story'
ON CONFLICT (campaign_id, key) DO NOTHING;

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
  -- The referral, paid once, on the first approval and never again.
  IF NOT v_was_approved_before AND v_entries >= 1 THEN
    -- Locked rather than claimed by writing awarded_at first. The
    -- referral_award_consistent CHECK requires awarded_at and awarded_ledger_id
    -- to be set together, so there is no half state to claim with: the row
    -- lock is what serialises two approvals racing for one creator.
    SELECT * INTO v_referral FROM referrals
     WHERE referred_campaign_creator_id = v_cc
       AND awarded_at IS NULL
     FOR UPDATE;

    IF v_referral.id IS NOT NULL THEN
      SELECT COALESCE(default_points, 0) INTO v_referral_points
        FROM point_rules
       WHERE campaign_id = v_campaign AND key = 'referral';

      -- Nothing configured means nothing is paid and the referral stays
      -- payable, rather than being marked paid for zero and lost.
      IF COALESCE(v_referral_points, 0) > 0 THEN
        BEGIN
          INSERT INTO point_ledger (
            campaign_id, campaign_creator_id, source, points, idempotency_key, note
          ) VALUES (
            v_campaign,
            v_referral.referrer_campaign_creator_id,
            'referral',
            v_referral_points,
            'referral:' || v_referral.id::text,
            'Referred creator had their first approved entry.'
          )
          RETURNING id INTO v_ledger_id;
        EXCEPTION
          WHEN unique_violation THEN
            -- Already paid for this referral. The idempotency key is the
            -- second guard behind the row lock, and it holds even if this
            -- function is ever called from somewhere that does not take one.
            v_ledger_id := NULL;
        END;

        IF v_ledger_id IS NOT NULL THEN
          -- Both fields together, which is what the CHECK requires and what
          -- makes "paid" mean "there is a ledger row proving it".
          UPDATE referrals
             SET awarded_at = now(), awarded_ledger_id = v_ledger_id
           WHERE id = v_referral.id;

          -- Recomputed from the ledger rather than incremented, the same way
          -- every other total here is.
          UPDATE campaign_creators cc SET
            points_total = (
              SELECT COALESCE(sum(points), 0) FROM point_ledger
               WHERE campaign_creator_id = v_referral.referrer_campaign_creator_id
            )
           WHERE cc.id = v_referral.referrer_campaign_creator_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_target;
END $$;
