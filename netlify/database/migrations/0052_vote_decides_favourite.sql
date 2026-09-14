/*
 * The vote decides the Community Favourite; announcing only records it.
 *
 * publish_weekly_winner already refused to publish a Community Favourite
 * before the week's round was closed and its suspicious-vote sweep marked
 * done (P0805, 0048). But nothing bound the announced NAME to the tally:
 * the console's picker was the same free-choice list as Creator of the
 * Week, so the only thing connecting the announcement to the vote was the
 * admin reading the tally and picking the matching person. The rules say
 * the highest number of valid votes wins, so the engine now enforces it.
 *
 * With a reviewed round in place, a published Community Favourite must be:
 *   - the nominee whose entry took the most countable votes, ties broken
 *     by that week's recorded standings exactly as the rules publish
 *     (a deeper tie, same votes and same standings points, leaves the
 *     choice among the tied nominees only), else P0806; and
 *   - with zero countable votes, any shortlisted nominee, since the rules
 *     fall back to Blockfest selecting, but only from the shortlist people
 *     were shown, else P0807.
 * The winning entry travels with the announcement automatically, so the
 * public page keeps linking the content people actually voted for even if
 * the caller passed no entry. Weeks with no on-site round (the social-poll
 * fallback) are untouched: the picker stays a genuine selection there.
 *
 * The disputed path stays what it was: to change the outcome, remove
 * fraudulent votes through the audited sweep and the tally changes with
 * it. There is deliberately no override that publishes a non-winner while
 * a round stands.
 *
 * publish_weekly_winner last shipped in 0048; an applied migration is
 * immutable, so the regeneration lands here, from 0048's exact body plus
 * the new gate. 0051 is already on main, so the numbering is in order.
 */

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
    SELECT id INTO v_round FROM vote_rounds
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
             AND s.version = (
                   SELECT max(version) FROM leaderboard_snapshots
                    WHERE campaign_id = v_campaign AND week_no = p_week_no
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
