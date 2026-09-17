-- The pack resources become rows the team edits without a deploy (#70).
--
-- The constraint that matters is stated in the issue and enforced by the
-- renderer: PLAIN TEXT ONLY. React escapes by default and nothing here ever
-- uses dangerouslySetInnerHTML, so HTML typed into a field renders as the
-- characters themselves. Admin-managed markup on a surface that also awards
-- five million naira is a stored-XSS path straight to self-awarding points,
-- which is why rich text is out of scope on purpose, not as a limitation.
--
-- URLs are held to https on the way in. A javascript: href would execute in
-- the one place escaping cannot save you, the attribute, and the public page
-- links these directly.

CREATE OR REPLACE FUNCTION upsert_resource(
  p_id            uuid,
  p_admin         uuid,
  p_campaign_slug text,
  p_section       text,
  p_title         text,
  p_body          text,
  p_url           text,
  p_display_order smallint,
  p_is_published  boolean
)
RETURNS TABLE (resource_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_title    text := btrim(COALESCE(p_title, ''));
  v_section  text := lower(btrim(COALESCE(p_section, '')));
  v_body     text := NULLIF(btrim(COALESCE(p_body, '')), '');
  v_url      text := NULLIF(btrim(COALESCE(p_url, '')), '');
  v_id       uuid;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'title_required' USING ERRCODE = 'P0912';
  END IF;

  IF v_section !~ '^[a-z0-9_-]{2,40}$' THEN
    RAISE EXCEPTION 'section_invalid' USING ERRCODE = 'P0913';
  END IF;

  IF v_body IS NULL AND v_url IS NULL THEN
    RAISE EXCEPTION 'content_required' USING ERRCODE = 'P0914';
  END IF;

  IF v_url IS NOT NULL AND v_url !~* '^https://' THEN
    RAISE EXCEPTION 'url_not_https' USING ERRCODE = 'P0915';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO resources (
      campaign_id, section, title, body, url, display_order, is_published,
      updated_at, updated_by_admin_id
    ) VALUES (
      v_campaign, v_section, v_title, v_body, v_url,
      COALESCE(p_display_order, 0), COALESCE(p_is_published, false),
      now(), p_admin
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE resources SET
      section = v_section,
      title = v_title,
      body = v_body,
      url = v_url,
      display_order = COALESCE(p_display_order, display_order),
      is_published = COALESCE(p_is_published, is_published),
      updated_at = now(),
      updated_by_admin_id = p_admin
    WHERE id = p_id AND campaign_id = v_campaign
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0916';
    END IF;
  END IF;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after
  ) VALUES (
    v_campaign, p_admin,
    CASE WHEN p_id IS NULL THEN 'resource.created' ELSE 'resource.updated' END,
    'resource', v_id,
    jsonb_build_object('section', v_section, 'title', v_title, 'published', COALESCE(p_is_published, false))
  );

  resource_id := v_id;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION delete_resource(
  p_id    uuid,
  p_admin uuid
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r resources%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  DELETE FROM resources WHERE id = p_id RETURNING * INTO r;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0916';
  END IF;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after
  ) VALUES (
    r.campaign_id, p_admin, 'resource.deleted', 'resource', r.id,
    jsonb_build_object('section', r.section, 'title', r.title)
  );
END $$;
