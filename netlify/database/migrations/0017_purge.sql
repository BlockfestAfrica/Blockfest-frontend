-- Clear a campaign's test data without clearing the campaign.
--
-- Production has been used for real testing: creators, submissions, approved
-- points, a referral. All of it has to go before Monday and none of the setup
-- can go with it. The obvious way to do that is the dangerous one. Dropping the
-- schema and re-migrating restores the campaign, the challenges, the point rules
-- and the admins, but it also destroys every Identity binding on admin_users, so
-- nobody can sign in to review on launch morning. Reaching for TRUNCATE instead
-- has the opposite failure: it is easy to include campaigns in the list, or to
-- add CASCADE, and then registration returns 404 because the campaign the whole
-- site looks up by slug is gone.
--
-- So this is one function that knows which tables hold people and which hold
-- setup, and a test that fails if a new table is ever added to neither list.

-- ---------------------------------------------------------------------------
-- First, close the hole the purge itself opens.
--
-- admin_users already refuses DELETE: every approval, award and audit row
-- points at it ON DELETE SET NULL, so removing an admin anonymises history
-- rather than erasing it. But that guard is a row trigger, and row triggers do
-- not fire on TRUNCATE. A hurried TRUNCATE ... CASCADE on a Sunday night would
-- walk straight past it and take every admin and every Identity binding with
-- it. A statement-level trigger is the version that actually holds.

CREATE OR REPLACE FUNCTION refuse_admin_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'admin_users is never truncated: it carries the Netlify Identity binding for every reviewer, and losing it locks everyone out of review. To clear campaign data use purge_campaign_data(slug, slug).'
    USING ERRCODE = 'P0302';
END $$;

DROP TRIGGER IF EXISTS admin_users_no_truncate ON admin_users;

CREATE TRIGGER admin_users_no_truncate
  BEFORE TRUNCATE ON admin_users
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_admin_truncate();

-- Same reasoning for the row every page load depends on.
CREATE OR REPLACE FUNCTION refuse_campaign_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'campaigns is never truncated: the site looks the campaign up by slug, so an empty table is a 404 on every campaign page. To clear campaign data use purge_campaign_data(slug, slug).'
    USING ERRCODE = 'P0302';
END $$;

DROP TRIGGER IF EXISTS campaigns_no_truncate ON campaigns;

CREATE TRIGGER campaigns_no_truncate
  BEFORE TRUNCATE ON campaigns
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_campaign_truncate();

-- ---------------------------------------------------------------------------
-- The purge.
--
-- The slug is passed twice on purpose. There is no undo and no backup taken
-- here, so the cost of typing it again is the cheapest safety there is.

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

  -- Child before parent throughout. referrals goes before point_ledger
  -- specifically: awarded_ledger_id is ON DELETE SET NULL while awarded_at
  -- stays put, and referral_award_consistent requires the two to agree, so
  -- clearing the ledger first turns every paid referral into a check violation.

  DELETE FROM votes v USING vote_rounds r
   WHERE v.round_id = r.id AND r.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'votes'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_round_nominees vn USING vote_rounds r
   WHERE vn.round_id = r.id AND r.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_round_nominees'; rows_deleted := n; RETURN NEXT;

  DELETE FROM vote_rounds WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_rounds'; rows_deleted := n; RETURN NEXT;

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

  DELETE FROM challenge_entries ce USING campaign_creators cc
   WHERE ce.campaign_creator_id = cc.id AND cc.campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'challenge_entries'; rows_deleted := n; RETURN NEXT;

  -- Handles hang off the creator, not the enrolment, so they are cleared for
  -- the creators this purge is about to orphan and nobody else's.
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

  -- A creator enrolled somewhere else is somebody else's participant. Only the
  -- ones left with no enrolment at all are deleted.
  DELETE FROM creators WHERE id IN (SELECT creator_id FROM purge_orphans);
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'creators'; rows_deleted := n; RETURN NEXT;

  -- Rate-limit state, deliberately cleared: a phone used for testing should not
  -- start Monday already throttled.
  DELETE FROM registration_attempts;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'registration_attempts'; rows_deleted := n; RETURN NEXT;

  -- Campaign-scoped audit only. Rows with no campaign are about admins binding
  -- their Identity account, which survives the purge and should stay readable.
  DELETE FROM audit_log WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  -- Logged after the delete, so the purge is the first thing in the new log
  -- rather than the last thing removed from the old one.
  INSERT INTO audit_log (campaign_id, action, entity_type, entity_id, note)
  VALUES (v_campaign, 'campaign.purged', 'campaign', v_campaign,
          'Test data cleared from the database console before launch.');
END $$;

-- ---------------------------------------------------------------------------
-- The same purge, reachable from the admin screen, with the guards a button
-- needs and a console does not.
--
-- The console version above is deliberately general: whoever has a psql prompt
-- against production already has every power this function could withhold. But
-- the connection string for Netlify DB is not a site environment variable you
-- can read in the dashboard, so in practice nobody has that prompt at eleven on
-- a Sunday night, and a purge nobody can run is not a purge. Hence a button.
--
-- A button that erases a campaign needs to stop being a button. Three things
-- have to be true, and the third one disarms it permanently:
--
--   the caller is an active owner,
--   the campaign is paused, so this cannot happen underneath live traffic,
--   the campaign has not started yet.
--
-- That last one is the important one. The only purge anyone has asked for is
-- the one that clears test data before launch. From the moment the campaign
-- opens, every row in it belongs to somebody who entered in good faith, and no
-- amount of confirming should be able to take it. The window closes by itself,
-- at the same instant registration opens, with nobody needing to remember.

CREATE OR REPLACE FUNCTION purge_before_launch(
  p_slug text, p_confirm text, p_admin uuid
)
RETURNS TABLE (table_name text, rows_deleted integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign  uuid;
  v_starts_at timestamptz;
  v_paused    timestamptz;
  v_role      text;
  v_active    boolean;
BEGIN
  SELECT role::text, is_active INTO v_role, v_active
    FROM admin_users WHERE id = p_admin;

  IF v_role IS NULL OR NOT v_active THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  -- Checked here as well as in the route. The route can be changed by anyone
  -- who can open a pull request; this cannot be changed without a migration.
  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE = 'P0403';
  END IF;

  SELECT id, starts_at, paused_at INTO v_campaign, v_starts_at, v_paused
    FROM campaigns WHERE slug = p_slug;

  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'no campaign with slug %', p_slug USING ERRCODE = 'P0602';
  END IF;

  IF v_paused IS NULL THEN
    RAISE EXCEPTION 'pause_first' USING ERRCODE = 'P0603';
  END IF;

  IF v_starts_at IS NULL OR now() >= v_starts_at THEN
    RAISE EXCEPTION 'campaign_already_open' USING ERRCODE = 'P0604';
  END IF;

  RETURN QUERY SELECT * FROM purge_campaign_data(p_slug, p_confirm);

  -- purge_campaign_data logs with no actor, because the console has none. This
  -- one does, so the row gets a name against it.
  UPDATE audit_log SET
    actor_admin_id = p_admin,
    note = 'Test data cleared from the admin screen before launch.'
   WHERE campaign_id = v_campaign
     AND action = 'campaign.purged'
     AND actor_admin_id IS NULL;
END $$;
