/*
 * A handle CHANGE cannot take a handle somebody else holds.
 *
 * The UI audit found no uniqueness on handles at all: 0000 had a unique
 * index on (platform, handle_normalized), 0002 replaced it with a partial
 * index conditioned on verified_at, and 0034 then removed verification
 * entirely, so nothing has set verified_at since and that index constrains
 * zero rows. Register with a rival's X handle and submit_entry's
 * wrong_account check passes for THEIR posts.
 *
 * This migration deliberately does NOT restore the unconditional index.
 * 0002 dropped it for a reason the tests still state plainly: with it, the
 * first person to type a well-known creator's handle locks that creator
 * out of the campaign entirely, at registration, with no self-service way
 * back. Trading silent post-theft for guaranteed lockout of real
 * creators is not an improvement, and reversing a documented team
 * decision mid-campaign is a product call rather than a patch.
 *
 * What it does instead is close the escalation the audit actually found.
 * Registration keeps its accepted trade-off; CHANGING a handle onto one
 * another creator already holds is refused (P0911), in both places a
 * change can happen: the console correction and the approval of a
 * creator's own request, which both pass through correct_social_handle,
 * and at filing time so the creator hears it immediately.
 *
 * 0034 named the reviewer as the defence against squatting. The pending
 * queue never showed them the collision, so the defence could not be
 * exercised; lib/admin/handle-requests.ts now surfaces it beside the
 * Approve button. Both bodies are their live definitions (0035, 0036)
 * plus the guard; every raise is kept.
 */

CREATE OR REPLACE FUNCTION correct_social_handle(
  p_enrolment  uuid,
  p_platform   platform,
  p_new_handle text,
  p_admin      uuid,
  p_reason     text
)
RETURNS TABLE (old_handle text, new_handle text)
LANGUAGE plpgsql AS $$
DECLARE
  v_creator uuid;
  v_campaign uuid;
  v_handle  record;
  -- Normalised the way registration normalises: trimmed, @ stripped, lowered.
  v_new     text := lower(regexp_replace(btrim(COALESCE(p_new_handle, '')), '^@+', ''));
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    -- The same rule as every other action that moves a creator's standing.
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  -- The exact shape registration accepts, so a correction cannot introduce a
  -- handle the form could never have produced.
  IF v_new !~ '^[a-z0-9._]{1,40}$' THEN
    RAISE EXCEPTION 'handle_invalid' USING ERRCODE = 'P0903';
  END IF;

  SELECT creator_id, campaign_id INTO v_creator, v_campaign
    FROM campaign_creators WHERE id = p_enrolment;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  SELECT * INTO v_handle
    FROM creator_social_handles
   WHERE creator_id = v_creator AND platform = p_platform
   FOR UPDATE;
  IF v_handle.id IS NULL THEN
    RAISE EXCEPTION 'handle_not_found' USING ERRCODE = 'P0901';
  END IF;

  /*
   * Nobody else's handle. This is where it must live, because it is the
   * one statement every path to a handle change goes through: the console
   * correction, and the approval of a creator's own request.
   */
  IF EXISTS (
    SELECT 1 FROM creator_social_handles h
     WHERE h.platform = p_platform
       AND h.handle_normalized = v_new
       AND h.creator_id <> v_creator
  ) THEN
    RAISE EXCEPTION 'handle_taken' USING ERRCODE = 'P0911';
  END IF;

  UPDATE creator_social_handles SET
    handle = v_new,
    handle_normalized = v_new,
    /*
     * The verification state belonged to the old handle, so it does not carry.
     * Enforcement is off since 0034, but leaving verified_at standing against
     * a handle nobody ever proved would make the column lie to whoever turns
     * enforcement back on. A fresh code is minted for the same reason.
     */
    verified_at = NULL,
    verification_code = 'BF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  WHERE id = v_handle.id;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'handle.corrected', 'creator_social_handle', v_handle.id,
    jsonb_build_object(
      'platform', p_platform::text,
      'from', v_handle.handle,
      'to', v_new
    ),
    btrim(p_reason)
  );

  old_handle := v_handle.handle;
  new_handle := v_new;
  RETURN NEXT;
END $$;

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
    /*
     * Told at filing time, not after an owner wastes a decision on it.
     * The binding check lives in correct_social_handle, which every
     * approval runs through; this one exists so the creator hears it
     * immediately and the queue never fills with requests that cannot be
     * granted.
     */
    IF EXISTS (
      SELECT 1 FROM creator_social_handles h
       WHERE h.platform = p_platform
         AND h.handle_normalized = v_new
         AND h.creator_id <> v_creator
    ) THEN
      RAISE EXCEPTION 'handle_taken' USING ERRCODE = 'P0911';
    END IF;

    INSERT INTO handle_change_requests (
      campaign_creator_id, platform, old_handle, requested_handle, reason
    ) VALUES (
      p_enrolment, p_platform, v_current, v_new, v_reason
    ) RETURNING id INTO v_id;
  END IF;

  request_id := v_id;
  RETURN NEXT;
END $$;
