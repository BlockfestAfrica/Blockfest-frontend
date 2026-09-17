-- Winners integrity, from the day-one admin audit.
--
-- publish_weekly_winner regenerated from 0021, its latest definition, with
-- three guards added and everything else verbatim:
--
-- 1. A published winner is immutable. The bare upsert let a second call
--    silently replace or un-publish a name and amount that were already on
--    the public page, with the first winner's congratulation email already
--    sent; repeats now refuse with winner_already_published, which also
--    ends the duplicate-email path, since only the one transition to
--    published ever succeeds.
--
-- 2. A disqualified creator cannot be announced. The candidate list omits
--    them, but a stale screen could still submit the id.
--
-- 3. Publishing requires the week's standings to have been recorded first;
--    the Saturday freeze is what the Sunday announcement commits money
--    against. Drafts are still allowed at any time.

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
  v_campaign uuid;
  v_id       uuid;
  v_when     timestamptz := CASE WHEN p_publish THEN now() ELSE NULL END;
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
      v_campaign, p_week_no, p_category, p_enrolment, p_entry,
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

  winner_id := v_id;
  published := p_publish;
  RETURN NEXT;
END $$;
