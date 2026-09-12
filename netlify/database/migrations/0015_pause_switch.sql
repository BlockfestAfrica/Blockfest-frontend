-- A pause an owner can reach without a deploy.
--
-- Until now the only ways to stop people entering were a code change and a
-- build, or editing the database by hand with a connection string that
-- lib/db/client.ts says is not readable from the dashboard. On a launch morning
-- with something going wrong, neither is a plan.
--
-- Deliberately not the campaign_status enum. Setting status to 'closed' means
-- the campaign has ended, and it is read by the endpoints, the pages and later
-- by the archive: using it for a temporary pause would make "ended" and "paused
-- for twenty minutes" the same state, and the second one has to be reversible
-- without looking like the first.
--
-- The reason is part of the switch rather than an optional extra. A creator who
-- meets a silent refusal tries again and then complains, and somebody has to
-- answer them. Saying why costs one sentence at the moment of pausing and saves
-- every one of those.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS paused_by_admin_id uuid REFERENCES admin_users(id) ON DELETE set null;

-- A pause is answerable afterwards: when, why, and who. A pause with no reason
-- is the silent failure this exists to avoid, so it is refused.
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaign_pause_explained;

ALTER TABLE campaigns
  ADD CONSTRAINT campaign_pause_explained
  CHECK (
    (paused_at IS NULL AND paused_reason IS NULL) OR
    (paused_at IS NOT NULL AND btrim(COALESCE(paused_reason, '')) <> '')
  );

-- ---------------------------------------------------------------------------
-- Flip it, and record who did it.
--
-- One function for both directions so there is a single place that decides what
-- pausing means, and so resuming cannot leave a reason behind that no longer
-- applies.

CREATE OR REPLACE FUNCTION set_campaign_pause(
  p_slug     text,
  p_paused   boolean,
  p_reason   text,
  p_admin_id uuid
)
RETURNS TABLE (paused boolean, reason text, changed_at timestamp with time zone)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_reason   text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_slug FOR UPDATE;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_paused AND v_reason = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0402';
  END IF;

  UPDATE campaigns SET
    paused_at = CASE WHEN p_paused THEN now() ELSE NULL END,
    paused_reason = CASE WHEN p_paused THEN v_reason ELSE NULL END,
    paused_by_admin_id = CASE WHEN p_paused THEN p_admin_id ELSE NULL END,
    updated_at = now()
  WHERE id = v_campaign;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after, note)
  VALUES (
    v_campaign, p_admin_id,
    CASE WHEN p_paused THEN 'campaign.paused' ELSE 'campaign.resumed' END,
    'campaign', v_campaign,
    jsonb_build_object('paused', p_paused, 'reason', NULLIF(v_reason, '')),
    CASE WHEN p_paused THEN v_reason ELSE 'Campaign resumed.' END
  );

  paused := p_paused;
  reason := NULLIF(v_reason, '');
  changed_at := now();
  RETURN NEXT;
END $$;
