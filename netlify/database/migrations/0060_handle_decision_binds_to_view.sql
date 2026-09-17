/*
 * A handle decision binds to what the owner was looking at.
 *
 * decide_handle_request applied the request row's live value, and a
 * creator can re-file while the queue is open: request_handle_change
 * updates the pending row in place rather than adding one, so the handle
 * an owner read on screen and the handle their click applied could be
 * different strings. The console now sends what it rendered, and a
 * disagreement raises P0909 instead of silently applying the newer value
 * to an account whose entries are scored against it.
 *
 * The old signature is DROPped first. A defaulted parameter does NOT make
 * CREATE OR REPLACE replace anything: Postgres mints an overload, and the
 * four-argument call every existing caller makes then resolves to neither
 * ("is not unique"). Same discipline 0051 applied to award_points, and the
 * reason the rule is written down. Body is 0053's exactly plus the guard;
 * every raise is kept.
 */

DROP FUNCTION IF EXISTS decide_handle_request(uuid, uuid, boolean, text);

CREATE OR REPLACE FUNCTION decide_handle_request(
  p_request uuid,
  p_admin   uuid,
  p_approve boolean,
  p_note    text,
  p_expected_handle text DEFAULT NULL
)
RETURNS TABLE (outcome text, old_handle text, new_handle text)
LANGUAGE plpgsql AS $$
DECLARE
  r          handle_change_requests%ROWTYPE;
  v_note     text := btrim(COALESCE(p_note, ''));
  v_campaign uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO r FROM handle_change_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0904';
  END IF;

  /*
   * The decision binds to the handle the owner was SHOWN. A creator can
   * file again while the queue sits open, and request_handle_change
   * updates the pending row in place, so an approval clicked against
   * "@typo-fixed" could apply whatever the row said a second later. The
   * console sends what it rendered; a mismatch is refused by name rather
   * than resolved in favour of whoever wrote last.
   */
  IF p_expected_handle IS NOT NULL
     AND r.requested_handle IS DISTINCT FROM p_expected_handle THEN
    RAISE EXCEPTION 'request_changed' USING ERRCODE = 'P0909';
  END IF;

  IF r.status <> 'pending' THEN
    -- Two admins racing to decide one request: the second is told rather than
    -- silently double-applying.
    RAISE EXCEPTION 'request_already_decided' USING ERRCODE = 'P0906';
  END IF;

  SELECT cc.campaign_id INTO v_campaign
    FROM campaign_creators cc WHERE cc.id = r.campaign_creator_id;

  IF p_approve THEN
    PERFORM correct_social_handle(
      r.campaign_creator_id, r.platform, r.requested_handle, p_admin,
      'Approved request ' || r.id::text || ': ' || r.reason
    );

    UPDATE handle_change_requests SET
      status = 'approved',
      decided_at = now(),
      decided_by_admin_id = p_admin,
      decision_note = NULLIF(v_note, '')
    WHERE id = r.id;

    outcome := 'approved';
  ELSE
    -- The note is what the creator reads on their own page, so a rejection
    -- with nothing to say is not accepted.
    IF v_note = '' THEN
      RAISE EXCEPTION 'note_required' USING ERRCODE = 'P0502';
    END IF;

    UPDATE handle_change_requests SET
      status = 'rejected',
      decided_at = now(),
      decided_by_admin_id = p_admin,
      decision_note = v_note
    WHERE id = r.id;

    outcome := 'rejected';
  END IF;

  /*
   * Both verdicts on the record under their own names. The approval was
   * previously visible only as the handle.corrected row its side effect
   * writes, and the rejection was visible nowhere: the request row carried
   * the decider, but the audit table never heard about it.
   */
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin,
    CASE WHEN p_approve THEN 'handle_request.approved'
         ELSE 'handle_request.rejected' END,
    'handle_change_request', r.id,
    jsonb_build_object(
      'platform', r.platform::text,
      'from', r.old_handle,
      'to', r.requested_handle
    ),
    NULLIF(v_note, '')
  );

  old_handle := r.old_handle;
  new_handle := r.requested_handle;
  RETURN NEXT;
END $$;
