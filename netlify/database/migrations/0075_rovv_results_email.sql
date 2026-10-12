/*
 * The results email, and what the second review of the end-to-end walk
 * found (12 October 2026). 0074 is applied on a preview and frozen, so the
 * functions it defined are redefined here, from 0074, keeping every rule.
 *
 * The results email: until now only the twenty winners ever heard the
 * result. The owner sends one "the winners are announced" email to everyone
 * else who entered and was not ruled out, once every picked winner has been
 * told. results_claimed_at is a press's claim on one recipient, taken just
 * before their mail and dropped if it fails (and treated as abandoned after
 * six minutes, longer than a press runs); results_emailed_at is set only
 * for a mail that left, so a press cut short strands nobody and nobody gets
 * it twice.
 *
 * decide_rovv_entry takes the ruling the reviewer's card showed, and
 * set_rovv_winner refuses a second win under one username and a pick of
 * somebody already sent the results, both under the locks they already
 * hold. New codes P1018 to P1020 (lib/db/errors.ts).
 */
ALTER TABLE rovv_entries
  ADD COLUMN results_emailed_at timestamptz,
  ADD COLUMN results_claimed_at timestamptz;

DROP FUNCTION decide_rovv_entry(uuid, text, text, uuid, integer);

CREATE OR REPLACE FUNCTION decide_rovv_entry(
  p_entry    uuid,
  p_status   text,
  p_note     text,
  p_admin_id uuid,
  /* The revision the reviewer was looking at. Entries can be replaced
     until they are approved, so a ruling on a version the entrant has
     since replaced would rule on a video nobody watched. */
  p_revision integer,
  /* The ruling the reviewer's card showed (0075). Checked under the row
     lock, so of two reviewers ruling the same card at once, the second is
     refused rather than overturning the first and emailing the opposite.
     Defaults to no check, so the deploy still serving while this applies
     (which calls it with five arguments) keeps working. */
  p_from     text DEFAULT NULL
)
RETURNS TABLE (status text, winner boolean, previous text)
LANGUAGE plpgsql AS $$
DECLARE
  v_row  rovv_entries%ROWTYPE;
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  IF p_status NOT IN ('pending', 'eligible', 'ineligible') THEN
    RAISE EXCEPTION 'rovv_bad_status' USING ERRCODE = 'P1005';
  END IF;
  IF p_status = 'ineligible' AND v_note = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0402';
  END IF;

  SELECT * INTO v_row FROM rovv_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rovv_entry_not_found' USING ERRCODE = 'P1007';
  END IF;
  IF p_revision IS DISTINCT FROM v_row.revision THEN
    RAISE EXCEPTION 'rovv_entry_changed' USING ERRCODE = 'P1012';
  END IF;
  IF p_from IS NOT NULL AND p_from <> v_row.status THEN
    RAISE EXCEPTION 'rovv_ruled_meanwhile' USING ERRCODE = 'P1018';
  END IF;
  IF v_row.winner_at IS NOT NULL AND p_status <> 'eligible' THEN
    RAISE EXCEPTION 'rovv_winner_stays_eligible' USING ERRCODE = 'P1006';
  END IF;

  UPDATE rovv_entries SET
    status = p_status,
    review_note = CASE WHEN p_status = 'pending' THEN NULL ELSE NULLIF(v_note, '') END,
    reviewed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
    reviewed_by_admin_id = CASE WHEN p_status = 'pending' THEN NULL ELSE p_admin_id END,
    updated_at = now()
  WHERE id = p_entry;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, before, after, note)
  VALUES (
    v_row.campaign_id, p_admin_id, 'rovv_entry.' || p_status, 'rovv_entry', p_entry,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', p_status),
    NULLIF(v_note, '')
  );

  status := p_status;
  winner := v_row.winner_at IS NOT NULL;
  previous := v_row.status;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION set_rovv_winner(
  p_entry    uuid,
  p_pick     boolean,
  p_admin_id uuid
)
RETURNS TABLE (winners integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_row   rovv_entries%ROWTYPE;
  v_count integer;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO v_row FROM rovv_entries WHERE id = p_entry;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rovv_entry_not_found' USING ERRCODE = 'P1007';
  END IF;
  -- One owner at a time per campaign, so the count below stays true. NO KEY
  -- UPDATE, not UPDATE: picks still queue behind each other, but the foreign
  -- key checks of entries and audit rows arriving meanwhile do not wait on
  -- it, and a ruling on the same entry cannot deadlock against it.
  PERFORM 1 FROM campaigns WHERE id = v_row.campaign_id FOR NO KEY UPDATE;
  SELECT * INTO v_row FROM rovv_entries WHERE id = p_entry FOR UPDATE;

  IF p_pick THEN
    IF v_row.status <> 'eligible' THEN
      RAISE EXCEPTION 'rovv_not_eligible' USING ERRCODE = 'P1008';
    END IF;
    IF v_row.winner_at IS NULL THEN
      /* Each person wins once (0075): another winner under this username
         is refused here, under the campaign's lock, so two picks at once
         cannot both pass. */
      IF EXISTS (
        SELECT 1 FROM rovv_entries o
         WHERE o.campaign_id = v_row.campaign_id AND o.tiktok_handle = v_row.tiktok_handle
           AND o.is_test = v_row.is_test AND o.id <> v_row.id AND o.winner_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'rovv_already_won' USING ERRCODE = 'P1019';
      END IF;
      /* Somebody already told they did not win is not then made a winner. */
      IF v_row.results_emailed_at IS NOT NULL THEN
        RAISE EXCEPTION 'rovv_results_sent' USING ERRCODE = 'P1020';
      END IF;
      IF NOT v_row.is_test THEN
        SELECT count(*)::int INTO v_count FROM rovv_entries
         WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL AND NOT is_test;
        IF v_count >= 20 THEN
          RAISE EXCEPTION 'rovv_winners_full' USING ERRCODE = 'P1009';
        END IF;
      END IF;
      UPDATE rovv_entries SET winner_at = now(), winner_by_admin_id = p_admin_id, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.picked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle, 'test', v_row.is_test));
    END IF;
  ELSE
    IF v_row.notified_at IS NOT NULL THEN
      RAISE EXCEPTION 'rovv_winner_already_told' USING ERRCODE = 'P1010';
    END IF;
    IF v_row.notice_claimed_at > now() - interval '6 minutes' THEN
      RAISE EXCEPTION 'rovv_winner_being_told' USING ERRCODE = 'P1011';
    END IF;
    IF v_row.winner_at IS NOT NULL THEN
      UPDATE rovv_entries
         SET winner_at = NULL, winner_by_admin_id = NULL, ticket_code = NULL, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.unpicked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle, 'test', v_row.is_test));
    END IF;
  END IF;

  SELECT count(*)::int INTO winners FROM rovv_entries
   WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL AND NOT is_test;
  RETURN NEXT;
END $$;
