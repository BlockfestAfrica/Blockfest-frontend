/*
 * Every admin action leaves a row, and the row names the admin.
 *
 * The coverage sweep for the console's new audit page found the trail
 * nearly complete: sixteen actions already write audit_log with an actor,
 * from points.awarded to vote.removed. Four did not, and one of the four
 * is the most consequential action in the system:
 *
 *   - review() approved and rejected submissions with no audit row at
 *     all. Approval is what mints the points that split the prize pool;
 *     the submissions row carries who and when, but a reader of the audit
 *     table saw manual awards and never the engine-minted points beside
 *     them.
 *   - decide_handle_request() audited approvals only as the resulting
 *     handle.corrected row, and rejections not at all.
 *   - create_admin_session() left an ordinary sign-in with no trail. The
 *     sign-in row is the anchor every later action hangs off when a day
 *     has to be reconstructed.
 *   - The payout CSV export and admin sign-out are route-level and are
 *     closed in application code alongside this migration.
 *
 * Each function is regenerated from its live body exactly (review from
 * 0034, decide_handle_request from 0036, create_admin_session from 0029)
 * plus the one INSERT. Every raise is kept; the lineage guard checks.
 */

CREATE OR REPLACE FUNCTION review(
  p_sub    uuid,
  p_status submission_status,
  p_admin  uuid,
  p_note   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_entry    uuid;
  v_platform platform;
  v_active   boolean;
  v_campaign uuid;
  v_creator  uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  IF p_status = 'approved' THEN
    /*
     * FOR UPDATE OF cc, so the status read cannot race void_enrolment.
     *
     * Without the lock there is a window: the reviewer's approval reads
     * status = 'active', an admin's void commits, and the approval then pays
     * points to a creator who was disqualified a moment before, including the
     * referral their first approval triggers. OF cc, because it is only the
     * enrolment row whose stability matters here.
     */
    SELECT s.platform, COALESCE(cc.status, 'active') = 'active'
      INTO v_platform, v_active
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
     WHERE s.id = p_sub
       FOR UPDATE OF cc;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Before the handle check, because "this creator is disqualified" is the
    -- more useful sentence when both are true.
    IF NOT v_active THEN
      RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
    END IF;

    /*
     * Somebody else is already credited for this post.
     *
     * Checked by name rather than left to the unique index, because the index
     * raises unique_violation and the handler below maps that to
     * superseded_by_newer_submission, which is a different situation and the
     * wrong sentence to put in front of a reviewer.
     */
    IF EXISTS (
      SELECT 1
        FROM submissions other
        JOIN submissions mine ON mine.id = p_sub
       WHERE other.id <> p_sub
         AND other.status = 'approved'
         AND other.post_identity = mine.post_identity
    ) THEN
      RAISE EXCEPTION 'post_already_credited' USING ERRCODE = 'P0213';
    END IF;
  END IF;

  BEGIN
    UPDATE submissions
       SET status = p_status,
           reviewed_at = now(),
           reviewed_by_admin_id = p_admin,
           review_note = COALESCE(p_note, review_note)
     WHERE id = p_sub
     RETURNING entry_id INTO v_entry;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'superseded_by_newer_submission' USING ERRCODE = 'P0210';
  END;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  /*
   * The decision, on the record. Same transaction as the decision itself,
   * so there is no window where points moved and no row says who moved
   * them. The action string carries the status, so approved and rejected
   * filter apart on the audit page.
   */
  SELECT cc.campaign_id, ce.campaign_creator_id
    INTO v_campaign, v_creator
    FROM challenge_entries ce
    JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
   WHERE ce.id = v_entry;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'submission.' || p_status::text,
    'submission', p_sub,
    jsonb_build_object(
      'status', p_status::text,
      'entry_id', v_entry,
      'campaign_creator_id', v_creator
    ),
    p_note
  );

  PERFORM recompute_entry_award(v_entry);
END $$;

CREATE OR REPLACE FUNCTION decide_handle_request(
  p_request uuid,
  p_admin   uuid,
  p_approve boolean,
  p_note    text
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

CREATE OR REPLACE FUNCTION create_admin_session(
  p_email       text,
  p_identity_id text,
  p_token_hash  text
)
RETURNS TABLE (admin_id uuid, admin_role admin_role, admin_email text, expires_at timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  r         RECORD;
  v_expires timestamptz;
  v_email   text;
  v_session uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM resolve_admin(p_email, p_identity_id);
  IF r.admin_id IS NULL THEN
    RETURN;
  END IF;

  SELECT a.email_canonical INTO v_email FROM admin_users a WHERE a.id = r.admin_id;

  -- Expired rows are dead weight; two admins keep this tiny.
  DELETE FROM admin_sessions s WHERE s.expires_at <= now();

  -- Keep the newest four so this insert makes five. The shared inbox on two
  -- machines plus retries fits; a stolen password cannot grow the table without
  -- bound. Pruned by last_seen_at, so the idle session goes first.
  DELETE FROM admin_sessions s
   WHERE s.admin_id = r.admin_id
     AND s.id NOT IN (
       SELECT s2.id FROM admin_sessions s2
        WHERE s2.admin_id = r.admin_id
        ORDER BY s2.last_seen_at DESC
        LIMIT 4
     );

  -- Twelve hours, absolute, no renewal and no sliding. The defect being fixed
  -- is a credential that renews forever; a sliding window would rebuild that
  -- for a cookie thief. Twelve hours covers a launch-day shift, and signing in
  -- again is typing one password.
  v_expires := now() + interval '12 hours';

  INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
  VALUES (r.admin_id, p_token_hash, v_expires)
  RETURNING id INTO v_session;

  /*
   * The anchor row. Every later action in a reconstructed day hangs off
   * "who signed in, when": identity binding already audited its one-time
   * first bind, but the ordinary sign-in left only a session row that the
   * next sign-in's pruning could delete.
   */
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after
  ) VALUES (
    NULL, r.admin_id, 'admin.signed_in', 'admin_session', v_session,
    jsonb_build_object('expires_at', v_expires)
  );

  admin_id    := r.admin_id;
  admin_role  := r.admin_role;
  admin_email := v_email;
  expires_at  := v_expires;
  RETURN NEXT;
END $$;
