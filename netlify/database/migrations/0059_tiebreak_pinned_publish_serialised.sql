/*
 * The tie-break stops moving after the decision, and a publish cannot race
 * itself. Three confirmed findings from the endpoint audit.
 *
 * ONE. publish_weekly_winner broke a Community Favourite vote tie on
 * max(version) of the week's standings. Snapshots version rather than
 * replace, so pressing Record again on Sunday, which any reviewer can do
 * and which the console calls lossless, silently re-based a tie that the
 * closed round had already settled. A reviewer with no power to announce
 * anything could therefore choose between two tied nominees. The round now
 * records the version it was closed against, and the tie-break reads that.
 *
 * TWO. The immutability check took FOR UPDATE on a row that does not exist
 * for the first publish of a slot, so it locked nothing: two owners
 * confirming the same slot in the same second both saw no published row,
 * both proceeded, and the upsert let the second overwrite a name whose
 * winner had already been mailed. An advisory lock exists before the row
 * does, and the upsert now refuses to touch a published row at all.
 *
 * THREE. Recording standings for a week whose round is already closed is
 * how ONE happens by accident rather than by malice, so take_leaderboard_
 * snapshot keeps working but close_vote_round pins the basis first.
 *
 * Both function bodies come from their live definitions (0052 and 0048)
 * with only these changes; every raise is kept and the lineage guard
 * checks that mechanically.
 */

ALTER TABLE vote_rounds
  ADD COLUMN IF NOT EXISTS tiebreak_snapshot_version smallint;

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
   * for good. NULL if the week was never recorded, which the announce gate
   * refuses separately (P0804), so this cannot quietly mean "newest".
   */
  SELECT max(version) INTO v_version
    FROM leaderboard_snapshots
   WHERE campaign_id = r.campaign_id AND week_no = r.week_no;

  UPDATE vote_rounds
     SET status = 'closed', tiebreak_snapshot_version = v_version
   WHERE id = p_round;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
  VALUES (r.campaign_id, p_admin, 'vote_round.closed', 'vote_round', p_round,
          jsonb_build_object('tiebreak_snapshot_version', v_version));
END $$;

CREATE OR REPLACE FUNCTION publish_weekly_winner(
  p_campaign_slug text,
  p_week_no       smallint,
  p_category      winner_category,
  p_enrolment     uuid,
  p_entry         uuid,
  p_prize_naira   integer,
  p_note          text,
  p_admin         uuid,
  p_publish       boolean
)
RETURNS TABLE (winner_id uuid, published boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign     uuid;
  v_id           uuid;
  v_when         timestamptz := CASE WHEN p_publish THEN now() ELSE NULL END;
  v_round        uuid;
  v_max_votes    integer;
  v_is_winner    boolean;
  v_winner_entry uuid;
  v_entry        uuid := p_entry;
  v_tiebreak_version smallint;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM campaign_creators
   WHERE id = p_enrolment AND campaign_id = v_campaign;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  -- A voided creator cannot be announced. The candidate list already omits
  -- them, but the list is a convenience and this is the rule: a name that
  -- was disqualified on Saturday must not be publishable on Sunday because
  -- it was still on somebody's screen.
  PERFORM 1 FROM campaign_creators
   WHERE id = p_enrolment AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator_not_active' USING ERRCODE = 'P0803';
  END IF;

  -- Announcing commits money against the standings, so the standings must
  -- exist: publishing requires the week to have been recorded. A draft is
  -- still allowed early, it commits nothing.
  IF p_publish AND NOT EXISTS (
    SELECT 1 FROM leaderboard_snapshots
     WHERE campaign_id = v_campaign AND week_no = p_week_no
  ) THEN
    RAISE EXCEPTION 'week_not_frozen' USING ERRCODE = 'P0804';
  END IF;

  -- Community Favourite with an on-site round: the vote decides, so the
  -- round must be closed and its suspicious-vote sweep marked done before
  -- a winner can be published against it. A week with no round (the
  -- social-poll fallback) is untouched by this gate.
  IF p_publish AND p_category = 'community_favourite' AND EXISTS (
    SELECT 1 FROM vote_rounds
     WHERE campaign_id = v_campaign AND week_no = p_week_no
  ) THEN
    PERFORM 1 FROM vote_rounds
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND status IN ('closed', 'published')
       AND reviewed_at IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'round_not_reviewed' USING ERRCODE = 'P0805';
    END IF;
  END IF;

  -- And past that gate, the name must be the vote's answer. Countable
  -- votes only, the same view the tally shows: verified, not held, on a
  -- nominee still standing. Ties break by the week's recorded standings,
  -- as published; a deeper tie leaves the choice among the tied nominees.
  -- Zero countable votes falls back to Blockfest selecting, shortlist
  -- only. The winning entry replaces whatever the caller passed, so the
  -- announcement always carries the content people voted for.
  IF p_publish AND p_category = 'community_favourite' THEN
    SELECT id, tiebreak_snapshot_version INTO v_round, v_tiebreak_version
      FROM vote_rounds
     WHERE campaign_id = v_campaign AND week_no = p_week_no;

    IF v_round IS NOT NULL THEN
      SELECT max(c.votes) INTO v_max_votes FROM (
        SELECT count(cv.id)::integer AS votes
          FROM vote_round_nominees n
          LEFT JOIN countable_votes cv ON cv.nominee_id = n.id
         WHERE n.round_id = v_round AND n.withdrawn_at IS NULL
         GROUP BY n.id
      ) c;

      IF COALESCE(v_max_votes, 0) = 0 THEN
        SELECT n.entry_id INTO v_winner_entry
          FROM vote_round_nominees n
          JOIN challenge_entries e ON e.id = n.entry_id
         WHERE n.round_id = v_round AND n.withdrawn_at IS NULL
           AND e.campaign_creator_id = p_enrolment
         LIMIT 1;
        IF v_winner_entry IS NULL THEN
          RAISE EXCEPTION 'not_on_shortlist' USING ERRCODE = 'P0807';
        END IF;
        v_entry := v_winner_entry;
      ELSE
        WITH counts AS (
          SELECT e.campaign_creator_id AS cc, n.entry_id AS entry,
                 count(cv.id)::integer AS votes
            FROM vote_round_nominees n
            JOIN challenge_entries e ON e.id = n.entry_id
            LEFT JOIN countable_votes cv ON cv.nominee_id = n.id
           WHERE n.round_id = v_round AND n.withdrawn_at IS NULL
           GROUP BY e.campaign_creator_id, n.entry_id
        ), standings AS (
          SELECT counts.*, COALESCE(s.points_total, 0) AS pts
            FROM counts
            LEFT JOIN leaderboard_snapshots s
              ON s.campaign_id = v_campaign
             AND s.week_no = p_week_no
             AND s.campaign_creator_id = counts.cc
             /* The version the round was CLOSED against, not whatever is
                newest now. A re-take on Sunday morning after a batch of
                approvals would otherwise re-base a tie that was already
                settled, and a reviewer who cannot announce anything could
                move the winner by pressing Record again. */
             AND s.version = COALESCE(
                   v_tiebreak_version,
                   (SELECT max(version) FROM leaderboard_snapshots
                     WHERE campaign_id = v_campaign AND week_no = p_week_no)
                 )
        ), tops AS (
          SELECT * FROM standings
           WHERE votes = (SELECT max(votes) FROM standings)
        ), winners AS (
          SELECT * FROM tops
           WHERE pts = (SELECT max(pts) FROM tops)
        )
        SELECT EXISTS (SELECT 1 FROM winners w WHERE w.cc = p_enrolment),
               (SELECT w.entry FROM winners w WHERE w.cc = p_enrolment LIMIT 1)
          INTO v_is_winner, v_winner_entry;

        IF NOT v_is_winner THEN
          RAISE EXCEPTION 'not_the_vote_winner' USING ERRCODE = 'P0806';
        END IF;
        v_entry := v_winner_entry;
      END IF;
    END IF;
  END IF;

  -- A published winner is immutable from here. The upsert used to replace
  -- the row silently, so a second announce, a double-click, or a draft
  -- saved after publishing could swap or un-publish a name and amount that
  -- were already public, with the first winner's email already sent. The
  -- lock serialises two owners racing the same slot.
  /* FOR UPDATE locks rows, and the first publish of a slot has no row to
     lock: two owners confirming the same slot in the same second both saw
     no published row and both proceeded, and the upsert let the second
     overwrite the first after its winner had already been mailed. An
     advisory lock exists before the row does. */
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_campaign::text || ':' || p_week_no::text || ':' || p_category::text, 0)
  );
  PERFORM 1 FROM weekly_winners
   WHERE campaign_id = v_campaign AND week_no = p_week_no
     AND category = p_category
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM weekly_winners
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND category = p_category AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'winner_already_published' USING ERRCODE = 'P0802';
  END IF;

  BEGIN
    INSERT INTO weekly_winners (
      campaign_id, week_no, category, campaign_creator_id, entry_id,
      prize_amount_naira, note, published_at
    ) VALUES (
      v_campaign, p_week_no, p_category, p_enrolment, v_entry,
      p_prize_naira, NULLIF(btrim(COALESCE(p_note, '')), ''), v_when
    )
    ON CONFLICT (campaign_id, week_no, category) DO UPDATE
      SET campaign_creator_id = EXCLUDED.campaign_creator_id,
          entry_id            = EXCLUDED.entry_id,
          prize_amount_naira  = EXCLUDED.prize_amount_naira,
          note                = EXCLUDED.note,
          published_at        = EXCLUDED.published_at
      /* Belt and braces beside the check above: even a caller that raced
         past it cannot rewrite a row that is already public. */
      WHERE weekly_winners.published_at IS NULL
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The only index left that this can violate. Named, because "duplicate
      -- key value violates unique constraint" tells the admin nothing about
      -- which rule they met or why it exists.
      RAISE EXCEPTION 'already_creator_of_week' USING ERRCODE = 'P0801';
  END;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin,
    CASE WHEN p_publish THEN 'winner.published' ELSE 'winner.drafted' END,
    'weekly_winner', v_id,
    jsonb_build_object(
      'week_no', p_week_no,
      'category', p_category::text,
      'campaign_creator_id', p_enrolment,
      'prize_amount_naira', p_prize_naira
    ),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  -- The round follows the announcement into its terminal state.
  IF p_publish AND p_category = 'community_favourite' THEN
    UPDATE vote_rounds SET status = 'published'
     WHERE campaign_id = v_campaign AND week_no = p_week_no
       AND status = 'closed';
  END IF;

  winner_id := v_id;
  published := p_publish;
  RETURN NEXT;
END $$;
