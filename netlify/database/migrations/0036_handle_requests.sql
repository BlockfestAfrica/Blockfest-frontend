-- A creator asks for their handle to be corrected; an admin decides.
--
-- 0035 built the admin half of the mistyped-handle fix and left the request
-- half in email: the refusal message said "write to partnership@", and the
-- reason a creator gave lived in an inbox rather than in the product. The
-- owner's requirement is explicit: even when a creator requests the change in
-- the interface, an admin has to see the request and the reason in the
-- console, judge it, and approve it by hand before anything moves.
--
-- So a request is a row, not an edit. Nothing about the creator changes when
-- one is filed. The change happens only inside decide_handle_request, only on
-- approval, and only through correct_social_handle (0035), which is where the
-- shape check, the paired handle_normalized update, the verification reset and
-- the audit row already live. The decision itself is recorded on the request
-- row: who decided, when, and the note a rejection carries back to the
-- creator.

CREATE TABLE IF NOT EXISTS "handle_change_requests" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_creator_id" uuid NOT NULL REFERENCES campaign_creators(id) ON DELETE CASCADE,
  "platform"            platform NOT NULL,
  -- What the registration said when the request was filed, so the admin sees
  -- the same before-and-after the audit row will record, even if a direct fix
  -- happens in between.
  "old_handle"          text NOT NULL,
  "requested_handle"    text NOT NULL,
  -- The creator's own words. It is what the admin judges.
  "reason"              text NOT NULL,
  "status"              text NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "decided_at"          timestamptz,
  "decided_by_admin_id" uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  -- Read back by the creator on a rejection, so it is written to them.
  "decision_note"       text,
  CONSTRAINT "request_decided_consistently" CHECK (
    ("status" = 'pending'  AND "decided_at" IS NULL)
    OR ("status" <> 'pending' AND "decided_at" IS NOT NULL)
  )
);

-- One open request per account. A creator who changes their mind edits the
-- request rather than stacking a second behind it.
CREATE UNIQUE INDEX IF NOT EXISTS "handle_request_one_pending"
  ON "handle_change_requests" ("campaign_creator_id", "platform")
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "handle_request_pending"
  ON "handle_change_requests" ("status") WHERE "status" = 'pending';

-- ---------------------------------------------------------------------------
-- Filing a request, from the creator's own session.
--
-- Validates the same shape registration accepts, so an admin is never asked to
-- approve a value the form could not have produced. Filing again while a
-- request is pending replaces it, which is the creator correcting their own
-- request rather than an error.

CREATE OR REPLACE FUNCTION request_handle_change(
  p_enrolment  uuid,
  p_platform   platform,
  p_new_handle text,
  p_reason     text
)
RETURNS TABLE (request_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_creator uuid;
  v_current text;
  v_new     text := lower(regexp_replace(btrim(COALESCE(p_new_handle, '')), '^@+', ''));
  v_reason  text := btrim(COALESCE(p_reason, ''));
  v_id      uuid;
BEGIN
  IF v_reason = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  IF v_new !~ '^[a-z0-9._]{1,40}$' THEN
    RAISE EXCEPTION 'handle_invalid' USING ERRCODE = 'P0903';
  END IF;

  SELECT creator_id INTO v_creator
    FROM campaign_creators WHERE id = p_enrolment;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  -- A voided creator has nothing to correct a handle for.
  IF NOT enrolment_is_active(p_enrolment) THEN
    RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
  END IF;

  SELECT handle INTO v_current
    FROM creator_social_handles
   WHERE creator_id = v_creator AND platform = p_platform;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'handle_not_found' USING ERRCODE = 'P0901';
  END IF;

  IF v_current = v_new THEN
    RAISE EXCEPTION 'handle_unchanged' USING ERRCODE = 'P0905';
  END IF;

  -- Replace a pending request rather than stacking one behind it.
  UPDATE handle_change_requests SET
    old_handle = v_current,
    requested_handle = v_new,
    reason = v_reason,
    created_at = now()
  WHERE campaign_creator_id = p_enrolment
    AND platform = p_platform
    AND status = 'pending'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO handle_change_requests (
      campaign_creator_id, platform, old_handle, requested_handle, reason
    ) VALUES (
      p_enrolment, p_platform, v_current, v_new, v_reason
    ) RETURNING id INTO v_id;
  END IF;

  request_id := v_id;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Deciding, by an admin, by hand.
--
-- Approval goes through correct_social_handle and nowhere else, so a request
-- cannot become a second, weaker way of editing a handle: the same shape
-- check, the same paired-column update, the same verification reset and the
-- same audit row fire whether the admin fixed it directly or approved a
-- request. The audit note names the request so the two records join up.

CREATE OR REPLACE FUNCTION decide_handle_request(
  p_request uuid,
  p_admin   uuid,
  p_approve boolean,
  p_note    text
)
RETURNS TABLE (outcome text, old_handle text, new_handle text)
LANGUAGE plpgsql AS $$
DECLARE
  r      handle_change_requests%ROWTYPE;
  v_note text := btrim(COALESCE(p_note, ''));
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

  old_handle := r.old_handle;
  new_handle := r.requested_handle;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- The purge learns the new table. Regenerated from 0028, its latest
-- definition, with one DELETE and its own count added; requests hold handles
-- and a creator's own words, which is personal data, so "kept" was not an
-- option.

CREATE OR REPLACE FUNCTION purge_campaign_data(p_slug text, p_confirm text)
RETURNS TABLE (table_name text, rows_deleted integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  n          integer;
BEGIN
  IF p_confirm IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION
      'confirm by passing the slug twice: SELECT * FROM purge_campaign_data(%L, %L);', p_slug, p_slug
      USING ERRCODE = 'P0601';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'no campaign with slug %', p_slug USING ERRCODE = 'P0602';
  END IF;

  DELETE FROM votes v USING vote_rounds r
   WHERE v.round_id = r.id AND r.campaign_id = v_campaign;

  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'votes'; rows_deleted := n; RETURN NEXT;

  /*
   * The rate limit counters.
   *
   * Not campaign scoped, because a bucket is a client address and a limit name,
   * and neither knows which campaign the request was for. Cleared wholesale
   * anyway: the bucket is derived from an IP address, an IP address is personal
   * data, and "purge everything about this campaign" that leaves personal data
   * behind is not a purge. The cost of clearing it is that everybody's budget
   * resets, which lasts one window and matters to nobody.
   *
   * The table also expires its own rows after a day, so this is the floor
   * rather than the only cleanup.
   */
  DELETE FROM request_throttle;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'request_throttle'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_round_nominees vn USING vote_rounds r
   WHERE vn.round_id = r.id AND r.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_round_nominees'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_rounds WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_rounds'; rows_deleted := n; RETURN NEXT;

  -- Before weekly_winners, which it references by entry and by creator.
  n := purge_snapshots(v_campaign);
  table_name := 'leaderboard_snapshots'; rows_deleted := n; RETURN NEXT;

  DELETE FROM weekly_winners WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'weekly_winners'; rows_deleted := n; RETURN NEXT;

  DELETE FROM referrals WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'referrals'; rows_deleted := n; RETURN NEXT;

  DELETE FROM point_ledger WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'point_ledger'; rows_deleted := n; RETURN NEXT;

  DELETE FROM submissions s USING challenge_entries ce, campaign_creators cc
   WHERE s.entry_id = ce.id AND ce.campaign_creator_id = cc.id
     AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'submissions'; rows_deleted := n; RETURN NEXT;

  DELETE FROM handle_change_requests r USING campaign_creators cc
   WHERE r.campaign_creator_id = cc.id AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'handle_change_requests'; rows_deleted := n; RETURN NEXT;

  DELETE FROM challenge_entries ce USING campaign_creators cc
   WHERE ce.campaign_creator_id = cc.id AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'challenge_entries'; rows_deleted := n; RETURN NEXT;

  DELETE FROM creator_social_handles csh
   WHERE csh.creator_id IN (
     SELECT cc.creator_id FROM campaign_creators cc WHERE cc.campaign_id = v_campaign
   )
   AND NOT EXISTS (
     SELECT 1 FROM campaign_creators other
      WHERE other.creator_id = csh.creator_id AND other.campaign_id <> v_campaign
   );
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'creator_social_handles'; rows_deleted := n; RETURN NEXT;

  CREATE TEMP TABLE purge_orphans ON COMMIT DROP AS
    SELECT cc.creator_id FROM campaign_creators cc
     WHERE cc.campaign_id = v_campaign
       AND NOT EXISTS (
         SELECT 1 FROM campaign_creators other
          WHERE other.creator_id = cc.creator_id AND other.campaign_id <> v_campaign
       );

  DELETE FROM campaign_creators WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'campaign_creators'; rows_deleted := n; RETURN NEXT;

  DELETE FROM creators WHERE id IN (SELECT creator_id FROM purge_orphans);
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'creators'; rows_deleted := n; RETURN NEXT;

  DELETE FROM registration_attempts;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'registration_attempts'; rows_deleted := n; RETURN NEXT;

  DELETE FROM audit_log WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  INSERT INTO audit_log (campaign_id, action, entity_type, entity_id, note)
  VALUES (v_campaign, 'campaign.purged', 'campaign', v_campaign,
          'Test data cleared from the database console before launch.');
END $$;
