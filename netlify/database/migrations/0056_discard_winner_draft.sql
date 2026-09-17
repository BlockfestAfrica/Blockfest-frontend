/*
 * Discarding a winner draft, on the record.
 *
 * A draft could only ever be replaced by saving a different pick, never
 * simply removed: the owner who drafted the wrong person on Saturday had
 * to overwrite them with somebody else or leave the wrong name sitting in
 * the card all week. Deleting is the honest third option, and it gets the
 * same shape as every other console mutation: a function that checks the
 * actor, refuses the dangerous cases by name, and writes the audit row in
 * the same transaction as the act.
 *
 * A published winner is not deletable here or anywhere. Publishing is
 * immutable by design (P0802, since 0045); this function refuses it with
 * the same name so the console can say the real reason.
 */

CREATE OR REPLACE FUNCTION discard_winner_draft(
  p_campaign_slug text,
  p_week_no       smallint,
  p_category      winner_category,
  p_admin         uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_id       uuid;
  v_creator  uuid;
  v_prize    integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM weekly_winners
   WHERE campaign_id = v_campaign
     AND week_no = p_week_no
     AND category = p_category
     AND published_at IS NULL
  RETURNING id, campaign_creator_id, prize_amount_naira
    INTO v_id, v_creator, v_prize;

  IF v_id IS NULL THEN
    -- Nothing deleted: either the slot is already published, which must be
    -- said in those words, or there was never a draft to discard.
    IF EXISTS (
      SELECT 1 FROM weekly_winners
       WHERE campaign_id = v_campaign AND week_no = p_week_no
         AND category = p_category AND published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'winner_already_published' USING ERRCODE = 'P0802';
    END IF;
    RAISE EXCEPTION 'draft_not_found' USING ERRCODE = 'P0808';
  END IF;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, before
  ) VALUES (
    v_campaign, p_admin, 'winner.draft_discarded', 'weekly_winner', v_id,
    jsonb_build_object(
      'week_no', p_week_no,
      'category', p_category::text,
      'campaign_creator_id', v_creator,
      'prize_amount_naira', v_prize
    )
  );
END $$;
