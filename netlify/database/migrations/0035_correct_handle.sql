-- Correct a creator's registered handle, from the console.
--
-- The mistyped-handle dead end got half a fix in 0033's round: the refusal now
-- names the handle in the link beside the handle on file and tells the creator
-- to write in. This is the other half. The mail arrived at partnership@ and the
-- correction was a manual UPDATE by whoever was holding the database, which is
-- exactly the kind of step that gets done wrong at speed: handle changed,
-- handle_normalized forgotten, and the wrong_account check then refuses the
-- right account forever.
--
-- One function, so the two columns move together and the change is audited.
-- Corrections stay admin-mediated on purpose, and the route on top of this is
-- owner-only: with verification gone (0034), the registered handle IS the
-- attribution, and an interface that edits it is an interface that can point a
-- creator's identity at somebody else's account. A correction leaves a named
-- owner, a reason and an audit row; self-service would leave nothing.

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
