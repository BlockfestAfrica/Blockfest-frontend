-- The marketing point system, made true in the rules the engine reads.
--
-- The team's published table and the database disagreed on three values:
-- Featured by Blockfest paid a default of 100 against a published 50,
-- a wildcard win defaulted to 200 with a 600 cap against a published flat
-- 100, and the quality and engagement bonuses were capped at 300 against
-- published ranges ending at 200. The published numbers win: they are what
-- creators were told.
--
-- In-flight entries and awards: none of these rules snapshot onto entries,
-- manual awards read their bounds at award time, and every bonus already
-- awarded stands as its ledger row, exactly as the published adjustment
-- clause promises. Only awards made after this applies feel the new
-- defaults and ceilings.

UPDATE point_rules pr SET default_points = 50, max_points = 50
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'featured_blockfest';

UPDATE point_rules pr SET default_points = 100, max_points = 100
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'featured_monica';

UPDATE point_rules pr SET default_points = 100, max_points = 100
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'wildcard_win';

UPDATE point_rules pr SET default_points = 50, max_points = 200
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'quality_bonus';

-- The tier ladder starts at 20 for 5K views; the default follows it.
UPDATE point_rules pr SET default_points = 20, max_points = 200
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'engagement_milestone';


-- ---------------------------------------------------------------------------
-- The referral rule's bounds go: award_points refuses the referral source
-- outright (P0501), so a ±600 range on a rule the engine pays at a flat 10
-- was dead configuration that read like policy.
UPDATE point_rules pr SET min_points = NULL, max_points = NULL
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'referral';

-- ---------------------------------------------------------------------------
-- Engagement bonuses attach to entries. The old CHECK forbade entry_id on
-- every manual source, which made the published one-bonus-per-entry rule
-- unenforceable by construction; the partial unique index is that rule.
ALTER TABLE point_ledger DROP CONSTRAINT ledger_entry_id_iff_entry_source;
ALTER TABLE point_ledger ADD CONSTRAINT ledger_entry_id_iff_entry_source
  CHECK ((source IN ('challenge_entry', 'engagement_milestone') AND entry_id IS NOT NULL)
      OR (source NOT IN ('challenge_entry', 'engagement_milestone') AND entry_id IS NULL));

CREATE UNIQUE INDEX one_engagement_bonus_per_entry
  ON point_ledger (entry_id)
  WHERE source = 'engagement_milestone' AND points > 0;

-- ---------------------------------------------------------------------------
-- award_points regenerated from 0028 with the published-shape guards, the
-- per-source reversal floor, the fail-closed aggregate cap, and the entry
-- linkage. The signature gains p_entry, so the old five-argument form is
-- dropped first: OR REPLACE with new defaults would overload, not replace.
DROP FUNCTION award_points(uuid, ledger_source, integer, text, uuid);

CREATE FUNCTION award_points(
  p_enrolment uuid,
  p_source    ledger_source,
  p_points    integer,
  p_note      text,
  p_admin     uuid,
  p_entry     uuid DEFAULT NULL
)
RETURNS TABLE (ledger_id uuid, points_total integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_note     text := btrim(COALESCE(p_note, ''));
  v_min      integer;
  v_max      integer;
  v_held     integer;
  v_total    integer;
  v_cap      integer;
  v_manual   integer;
  v_default  integer;
  v_src_held integer;
  v_id       uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF p_source IN ('challenge_entry', 'referral') THEN
    RAISE EXCEPTION 'source_not_manual' USING ERRCODE = 'P0501';
  END IF;

  IF v_note = '' THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = 'P0502';
  END IF;

  IF COALESCE(p_points, 0) = 0 THEN
    RAISE EXCEPTION 'points_required' USING ERRCODE = 'P0503';
  END IF;

  SELECT campaign_id INTO v_campaign FROM campaign_creators WHERE id = p_enrolment;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  SELECT min_points, max_points, default_points INTO v_min, v_max, v_default
    FROM point_rules
   WHERE campaign_id = v_campaign AND key = p_source::text;

  IF v_min IS NULL AND v_max IS NULL THEN
    RAISE EXCEPTION 'no_bounds_configured' USING ERRCODE = 'P0504';
  END IF;

  IF v_min IS NOT NULL AND p_points < v_min THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = 'P0505';
  END IF;

  IF v_max IS NOT NULL AND p_points > v_max THEN
    RAISE EXCEPTION 'above_maximum' USING ERRCODE = 'P0506';
  END IF;

  /*
   * The published shape of each award, not just its ceiling.
   *
   * The point table the campaign publishes is specific: Featured by
   * Blockfest is a flat 50, Featured by Monica a flat 100, a wildcard a
   * flat 100, quality runs 50 to 200, and engagement moves on a seven-step
   * ladder. Bounds alone accepted a 40 for a flat 50 and a 73 on the
   * ladder, numbers no creator was ever told exist. A flat value is
   * recognised structurally, default equal to max, so a future flat rule
   * inherits the guard without editing this function.
   */
  IF p_points > 0 THEN
    IF v_default IS NOT NULL AND v_default = v_max AND p_points <> v_max THEN
      RAISE EXCEPTION 'not_the_published_value' USING ERRCODE = 'P0510';
    END IF;
    IF p_source = 'engagement_milestone'
       AND p_points NOT IN (20, 40, 60, 80, 100, 150, 200) THEN
      -- The ladder from the rules page, verbatim. Changing a tier is a
      -- rules change, which is a migration either way.
      RAISE EXCEPTION 'not_on_ladder' USING ERRCODE = 'P0511';
    END IF;
    IF p_source = 'quality_bonus' AND p_points < v_default THEN
      -- Quality publishes a floor as well as a ceiling. Collab does not,
      -- so this stays specific rather than generalising over defaults.
      RAISE EXCEPTION 'below_published_floor' USING ERRCODE = 'P0512';
    END IF;
  END IF;

  -- Engagement bonuses attach to the entry that earned the views: the
  -- published rule is one bonus per entry at its highest verified tier,
  -- and a rule with no entry on the row is unenforceable.
  IF p_source = 'engagement_milestone' THEN
    IF p_entry IS NULL THEN
      RAISE EXCEPTION 'entry_required' USING ERRCODE = 'P0514';
    END IF;
    PERFORM 1 FROM challenge_entries
     WHERE id = p_entry AND campaign_creator_id = p_enrolment;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'entry_not_theirs' USING ERRCODE = 'P0515';
    END IF;
  ELSIF p_entry IS NOT NULL THEN
    RAISE EXCEPTION 'entry_only_for_engagement' USING ERRCODE = 'P0514';
  END IF;

  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  /*
   * The aggregate ceiling, checked under the lock just taken so two concurrent
   * awards cannot both read a total below the cap and both pass.
   *
   * Only positive awards are capped. A reversal has to stay possible, or an
   * admin who reaches the ceiling by mistake has no way to undo it.
   */
  SELECT COALESCE(max_points, 0) INTO v_cap
    FROM point_rules
   WHERE campaign_id = v_campaign AND key = 'manual_total_cap';

  IF p_points > 0 THEN
    -- Fail closed: the cap row missing or zero means no positive manual
    -- award moves, not that every award moves uncapped. The old fail-open
    -- reading made the whole 5,000,000 guarantee rest on one row existing.
    IF COALESCE(v_cap, 0) <= 0 THEN
      RAISE EXCEPTION 'manual_cap_not_configured' USING ERRCODE = 'P0504';
    END IF;
    SELECT COALESCE(sum(points), 0) INTO v_manual
      FROM point_ledger
     WHERE campaign_creator_id = p_enrolment
       AND source NOT IN ('challenge_entry', 'referral');

    IF v_manual + p_points > v_cap THEN
      -- Carries both figures, because the admin's next move is a smaller award
      -- and guessing the remaining headroom is the slow way to find it.
      RAISE EXCEPTION 'manual_cap_exceeded: cap % holds %', v_cap, v_manual
        USING ERRCODE = 'P0508';
    END IF;
  END IF;

  /*
   * The floor, which the ceiling turned out to imply and did not deliver.
   *
   * The cap bounded what manual awards can add and exempted negative awards so
   * reversals stay possible. The adversarial review inverted it: with no
   * aggregate floor, a compromised reviewer session cannot inflate an ally
   * past 2000 but can DRAIN every rival to zero, three hundred points per
   * call, and deciding a leaderboard by lowering the others pays exactly as
   * well as raising your own.
   *
   * So manual sources collectively can never take more than they gave: the
   * creator's net manual sum stays at or above zero. Reversing your own award
   * always fits inside that. Removing points the ENGINE awarded is not a
   * correction, it is a disqualification, and void_enrolment is the tool that
   * does that with a reason, an audit row and a referral clawback.
   */
  IF p_points < 0 THEN
    -- Per source first: quality can only take back what quality gave.
    -- 0050 lowered the ceilings but the 0016 minima survived at -300 and
    -- -600, so a correction could exceed any award its source ever made.
    SELECT COALESCE(sum(points), 0) INTO v_src_held
      FROM point_ledger
     WHERE campaign_creator_id = p_enrolment AND source = p_source;
    IF v_src_held + p_points < 0 THEN
      RAISE EXCEPTION 'source_floor_exceeded: % holds %', p_source, v_src_held
        USING ERRCODE = 'P0513';
    END IF;

    SELECT COALESCE(sum(points), 0) INTO v_manual
      FROM point_ledger
     WHERE campaign_creator_id = p_enrolment
       AND source NOT IN ('challenge_entry', 'referral');

    IF v_manual + p_points < 0 THEN
      RAISE EXCEPTION 'manual_floor_exceeded: holds % manual', v_manual
        USING ERRCODE = 'P0509';
    END IF;
  END IF;

  -- Read the total under the lock taken above, so two admins correcting at once
  -- cannot each see enough points for a deduction that only one of them can
  -- have.
  SELECT cc.points_total INTO v_held
    FROM campaign_creators cc WHERE cc.id = p_enrolment;

  IF v_held + p_points < 0 THEN
    RAISE EXCEPTION 'would_go_negative: holds %', v_held USING ERRCODE = 'P0507';
  END IF;

  BEGIN
    INSERT INTO point_ledger (
      campaign_id, campaign_creator_id, source, points, note,
      awarded_by_admin_id, entry_id
    ) VALUES (
      v_campaign, p_enrolment, p_source, p_points, v_note, p_admin, p_entry
    ) RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- one_engagement_bonus_per_entry: the published one-per-entry rule.
      RAISE EXCEPTION 'engagement_already_awarded' USING ERRCODE = 'P0516';
  END;

  UPDATE campaign_creators cc SET
    points_total = (
      SELECT COALESCE(sum(points), 0) FROM point_ledger
       WHERE campaign_creator_id = p_enrolment
    )
   WHERE cc.id = p_enrolment
  RETURNING cc.points_total INTO v_total;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'points.awarded', 'campaign_creator', p_enrolment,
    jsonb_build_object('source', p_source::text, 'points', p_points),
    v_note
  );

  ledger_id := v_id;
  points_total := v_total;
  RETURN NEXT;
END $$;


-- ---------------------------------------------------------------------------
-- reprice_entry regenerated from 0038 with update_challenge's own rail: a
-- week that has ended is the record its winners were decided on.

CREATE OR REPLACE FUNCTION reprice_entry(
  p_entry  uuid,
  p_admin  uuid,
  p_reason text
)
RETURNS TABLE (points_before integer, points_after integer)
LANGUAGE plpgsql AS $$
DECLARE
  e        challenge_entries%ROWTYPE;
  ch       challenges%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_b2     integer;
  v_b3     integer;
  v_before integer;
  v_after  integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  SELECT * INTO e FROM challenge_entries WHERE id = p_entry FOR UPDATE;
  IF e.id IS NULL THEN
    RAISE EXCEPTION 'entry_not_found' USING ERRCODE = 'P0911';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = e.challenge_id;

  -- A week that has ended is the record its winners were decided on, the
  -- same rail update_challenge already holds. Repricing it would rewrite
  -- settled prize arithmetic under an audit trail that says otherwise.
  IF ch.ends_at < now() THEN
    RAISE EXCEPTION 'challenge_readonly' USING ERRCODE = 'P0907';
  END IF;

  SELECT
    COALESCE(max(CASE WHEN key = 'multi_platform_bonus_2' THEN default_points END), 0),
    COALESCE(max(CASE WHEN key = 'multi_platform_bonus_3' THEN default_points END), 0)
    INTO v_b2, v_b3
    FROM point_rules WHERE campaign_id = ch.campaign_id;

  SELECT points_total INTO v_before
    FROM campaign_creators WHERE id = e.campaign_creator_id;

  UPDATE challenge_entries SET
    base_points_snapshot = ch.base_points,
    bonus_2_snapshot = v_b2,
    bonus_3_snapshot = v_b3
  WHERE id = e.id;

  -- The engine's own reconciliation, so a reprice can never invent a total
  -- the ordinary path could not produce.
  PERFORM recompute_entry_award(e.id);

  SELECT points_total INTO v_after
    FROM campaign_creators WHERE id = e.campaign_creator_id;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    ch.campaign_id, p_admin, 'entry.repriced', 'challenge_entry', e.id,
    jsonb_build_object(
      'base', jsonb_build_object('from', e.base_points_snapshot, 'to', ch.base_points),
      'bonus_2', jsonb_build_object('from', e.bonus_2_snapshot, 'to', v_b2),
      'bonus_3', jsonb_build_object('from', e.bonus_3_snapshot, 'to', v_b3),
      'points_total', jsonb_build_object('from', v_before, 'to', v_after)
    ),
    v_reason
  );

  points_before := v_before;
  points_after  := v_after;
  RETURN NEXT;
END $$;


-- ---------------------------------------------------------------------------
-- recompute_entry_award regenerated from 0024. The referral block now
-- reconciles from the ledger's net on every recompute instead of firing
-- once on a latch: an unpaid referral genuinely stays payable, and a paid
-- one reverses when the approvals it was paid for are taken back.

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
    BEGIN
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

      IF v_entries >= 1 AND v_net = 0 AND COALESCE(v_referral_points, 0) > 0 THEN
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

