-- Prove the handle belongs to the person claiming it.
--
-- Registration accepts any string matching a handle pattern. Nothing has ever
-- checked that the person controls the account, and the handle is not
-- decoration: submission intake resolves a pasted URL back to an enrolment
-- through this table, so whoever holds the row collects the points for whatever
-- that account publishes.
--
-- 0002 already made exclusivity belong to a VERIFIED handle, so two people may
-- both claim an unverified one and a squatter cannot lock the real creator out.
-- What has never existed is the verification itself.
--
-- Deliberately manual. Automated OAuth for three platforms is days of work and
-- a pile of client secrets, for a 33-day campaign with tens of creators. A code
-- the creator publishes from the account, checked by a person, is proportionate
-- and ships today.

ALTER TABLE creator_social_handles
  ADD COLUMN IF NOT EXISTS verification_code text;

-- Hex, uppercased, six characters. No letters past F, so there is no O to be
-- confused with 0 and no I to be confused with 1: this gets read off a screen,
-- typed into a caption, and read back by somebody else.
--
-- Built from gen_random_uuid rather than gen_random_bytes, which lives in
-- pgcrypto rather than core. The suite caught that against PGlite; it would
-- otherwise have been a migration that failed at deploy time, which blocks the
-- publish.
UPDATE creator_social_handles
   SET verification_code = 'BF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
 WHERE verification_code IS NULL;

ALTER TABLE creator_social_handles
  ALTER COLUMN verification_code SET DEFAULT 'BF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

COMMENT ON COLUMN creator_social_handles.verification_code IS
  'Shown to the creator, published by them from the account, confirmed by an admin. Never proves anything on its own: the proof is a person seeing it on the account.';

-- ---------------------------------------------------------------------------
-- Verifying.
--
-- verified_at is set here and nowhere else. Registration must never set it,
-- because registration cannot check anything, and a column that two code paths
-- can write is a column whose meaning is whatever the last writer believed.

CREATE OR REPLACE FUNCTION verify_social_handle(
  p_handle uuid,
  p_admin  uuid
)
RETURNS TABLE (handle text, platform_name text)
LANGUAGE plpgsql AS $$
DECLARE
  h          RECORD;
  v_campaign uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT csh.id, csh.handle, csh.platform, csh.handle_normalized,
         csh.verified_at, csh.creator_id
    INTO h
    FROM creator_social_handles csh
   WHERE csh.id = p_handle;

  IF h.id IS NULL THEN
    RAISE EXCEPTION 'handle_not_found' USING ERRCODE = 'P0901';
  END IF;

  IF h.verified_at IS NOT NULL THEN
    -- Not an error worth failing over, but worth not pretending it happened
    -- twice: a second audit row would suggest a second act of checking.
    handle := h.handle;
    platform_name := h.platform::text;
    RETURN NEXT;
    RETURN;
  END IF;

  -- The partial unique index enforces this, and catching it here is what turns
  -- a constraint name into a sentence an admin can act on.
  IF EXISTS (
    SELECT 1 FROM creator_social_handles other
     WHERE other.platform = h.platform
       AND other.handle_normalized = h.handle_normalized
       AND other.verified_at IS NOT NULL
       AND other.id <> h.id
  ) THEN
    RAISE EXCEPTION 'handle_already_verified_elsewhere' USING ERRCODE = 'P0902';
  END IF;

  UPDATE creator_social_handles
     SET verified_at = now()
   WHERE id = p_handle;

  /*
   * Scoped to the campaign the creator is enrolled in.
   *
   * Left null, these rows survive a purge and then reference a handle that no
   * longer exists: an audit trail pointing at nothing, which is worse than no
   * row because somebody will try to follow it. The admin binding rows are null
   * on purpose, because they are about an admin rather than a campaign, and
   * this one is not.
   */
  SELECT cc.campaign_id INTO v_campaign
    FROM campaign_creators cc
   WHERE cc.creator_id = h.creator_id
   ORDER BY cc.joined_at
   LIMIT 1;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'handle.verified', 'creator_social_handle', p_handle,
    jsonb_build_object('platform', h.platform::text, 'handle', h.handle),
    format('Confirmed %s on %s belongs to this creator.', h.handle, h.platform)
  );

  handle := h.handle;
  platform_name := h.platform::text;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Releasing a claim.
--
-- A mistaken or abandoned claim has to be recoverable, or the first typo
-- becomes permanent and the real owner of the handle can never verify.
--
-- Voiding an enrolment clears its verifications rather than deleting the rows,
-- so the history of who claimed what survives the claim being withdrawn.

CREATE OR REPLACE FUNCTION void_enrolment(
  p_enrolment uuid,
  p_admin     uuid,
  p_reason    text
)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_creator  uuid;
  v_campaign uuid;
  v_reason   text := btrim(COALESCE(p_reason, ''));
  n          integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF v_reason = '' THEN
    -- The same rule as every other admin action that takes something away.
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0502';
  END IF;

  SELECT creator_id, campaign_id INTO v_creator, v_campaign
    FROM campaign_creators WHERE id = p_enrolment;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  UPDATE campaign_creators
     SET status = 'disqualified'
   WHERE id = p_enrolment;

  UPDATE creator_social_handles
     SET verified_at = NULL
   WHERE creator_id = v_creator
     AND verified_at IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'enrolment.voided', 'campaign_creator', p_enrolment,
    jsonb_build_object('handles_released', n),
    v_reason
  );

  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Approving through an unverified handle.
--
-- This is the whole point of the above. Approving mints points against a
-- 5,000,000 naira pool, and an unverified handle means nobody has established
-- that the account which published the work belongs to the person being paid
-- for it.
--
-- Refused in the database rather than in the review screen, because the screen
-- is one caller and this is a rule about the money.
--
-- Rejecting is deliberately still allowed. A reviewer looking at something
-- wrong should never be blocked from saying so, and a rejection pays nobody.

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
  v_verified timestamptz;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  IF p_status = 'approved' THEN
    SELECT s.platform, csh.verified_at
      INTO v_platform, v_verified
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      LEFT JOIN creator_social_handles csh
        ON csh.creator_id = cc.creator_id AND csh.platform = s.platform
     WHERE s.id = p_sub;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_verified IS NULL THEN
      RAISE EXCEPTION 'handle_not_verified' USING ERRCODE = 'P0211';
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

  PERFORM recompute_entry_award(v_entry);
END $$;
