/*
 * "If ROVV Takes Me to Blockfest…": Rovv's TikTok campaign, 13 to 18 October
 * 2026 (the owner, 12 October).
 *
 * Nothing like Monica's: no accounts, no stages, no points, no vote. A person
 * makes a TikTok, registers on the ROVV app, and enters once with a form:
 * name, email, TikTok username, the video's link and their ROVV referral
 * code. The team marks each entry eligible or not and picks 20 winners, who
 * win a Blockfest ticket each and are emailed by 20 October; their TikTok
 * usernames then show on the campaign page.
 *
 * So its own table, not Monica's creators and submissions: those need a
 * phone number, a Blockfest referral code, a weekly challenge and a points
 * ladder, and an email already in Monica would be refused (email_taken).
 * Entries carry personal details, so purge_campaign_data deletes them, by
 * campaign, like every other table that holds a person.
 *
 * One entry per person, by email (canonicalEmail in lib/campaign-registration.ts).
 * Entering again with the same email and the same TikTok username, while the
 * entry is not yet reviewed, replaces it (a better video, a corrected code);
 * anything else is refused, so nobody can overwrite another person's entry
 * by typing their email. One eligible entry per video, by the id in its
 * link (post_identity_of, 0025): pending entries may share a video, so
 * nobody can lock an author out of their own video by entering it first.
 *
 * The 20-winner cap cannot be a constraint; set_rovv_winner holds it under a
 * lock on the campaign's row, so two owners picking at once cannot pass it.
 *
 * Codes: P1001 to P1012 are new and Rovv's (lib/db/errors.ts).
 */

INSERT INTO campaigns (slug, name, tagline, status, starts_at, ends_at, timezone)
VALUES (
  'rovv',
  'If ROVV Takes Me to Blockfest',
  '#ROVVMeToBlockfest',
  'active',
  '2026-10-13 00:00:00+01',
  '2026-10-18 23:59:59+01',
  'Africa/Lagos'
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE rovv_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES campaigns(id),
  full_name             text NOT NULL,
  email                 text NOT NULL,
  email_canonical       text NOT NULL,
  tiktok_handle         text NOT NULL,
  tiktok_url            text NOT NULL,
  /* The video, as post_identity_of names it: a second spelling of the same
     link is the same video. */
  post_key              text NOT NULL,
  referral_code         text NOT NULL,
  rules_version         text NOT NULL,
  privacy_version       text NOT NULL,
  accepted_at           timestamptz NOT NULL DEFAULT now(),
  marketing_opt_in      boolean NOT NULL DEFAULT false,
  marketing_opt_in_at   timestamptz,
  status                text NOT NULL DEFAULT 'pending',
  review_note           text,
  reviewed_at           timestamptz,
  reviewed_by_admin_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  winner_at             timestamptz,
  winner_by_admin_id    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  notified_at           timestamptz,
  /* A winner's notice being sent right now, set by the console press that
     claimed it and cleared if the mail fails, so a second press (another
     tab, a reload) skips them and nobody can unpick them mid-send. A claim
     older than six minutes, longer than a send can run, counts as
     abandoned. */
  notice_claimed_at     timestamptz,
  /* Bumped each time the entrant replaces the entry, so a ruling names the
     version the reviewer actually watched (decide_rovv_entry). */
  revision              integer NOT NULL DEFAULT 1,
  ip_address            text,
  user_agent            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rovv_entry_status CHECK (status IN ('pending', 'eligible', 'ineligible')),
  CONSTRAINT rovv_entry_reviewed CHECK ((status = 'pending') = (reviewed_at IS NULL)),
  CONSTRAINT rovv_entry_ineligible_says_why
    CHECK (status <> 'ineligible' OR btrim(COALESCE(review_note, '')) <> ''),
  CONSTRAINT rovv_entry_winner_is_eligible CHECK (winner_at IS NULL OR status = 'eligible'),
  CONSTRAINT rovv_entry_told_only_if_winner CHECK (notified_at IS NULL OR winner_at IS NOT NULL),
  CONSTRAINT rovv_entry_marketing CHECK (marketing_opt_in = (marketing_opt_in_at IS NOT NULL)),
  CONSTRAINT rovv_entry_url_https CHECK (tiktok_url ~* '^https://')
);

CREATE UNIQUE INDEX rovv_entry_one_per_email ON rovv_entries (campaign_id, email_canonical);
/* One ELIGIBLE entry per video. Pending entries may share one (see
   submit_rovv_entry for why), and the reviewer decides whose it is; ruling a
   second one eligible fails here. */
CREATE UNIQUE INDEX rovv_entry_one_per_video ON rovv_entries (campaign_id, post_key)
  WHERE status = 'eligible';
CREATE INDEX rovv_entries_newest ON rovv_entries (campaign_id, created_at DESC);

/*
 * An entry, or a replacement for the same person's unreviewed one. Returns
 * what happened: 'created', 'updated', or 'unchanged' (the same entry sent
 * twice). The window and the pause are checked here as well as in the route,
 * so a request that slips past the route's clock still cannot enter late.
 */
CREATE OR REPLACE FUNCTION submit_rovv_entry(
  p_slug            text,
  p_full_name       text,
  p_email           text,
  p_email_canonical text,
  p_tiktok_handle   text,
  p_tiktok_url      text,
  p_referral_code   text,
  p_rules_version   text,
  p_privacy_version text,
  p_marketing       boolean,
  p_ip              text,
  p_user_agent      text
)
RETURNS TABLE (entry_id uuid, outcome text)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign  uuid;
  v_starts    timestamptz;
  v_ends      timestamptz;
  v_status    text;
  v_paused    timestamptz;
  /* The video id for a full link, as everywhere else (post_identity_of,
     0025). A short link keeps its case: its code is case-sensitive, and
     lowercasing it would make two different videos one. */
  v_key       text := CASE
    WHEN p_tiktok_url ~ '/video/[0-9]+' THEN post_identity_of(p_tiktok_url, 'tiktok')
    ELSE 'tiktok:' || p_tiktok_url
  END;
  v_existing  rovv_entries%ROWTYPE;
  v_id        uuid;
  v_judged    boolean;
  v_pass      integer;
BEGIN
  SELECT c.id, c.starts_at, c.ends_at, c.status::text, c.paused_at
    INTO v_campaign, v_starts, v_ends, v_status, v_paused
    FROM campaigns c WHERE c.slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'active' OR now() < v_starts OR now() > v_ends THEN
    RAISE EXCEPTION 'rovv_closed' USING ERRCODE = 'P1001';
  END IF;
  IF v_paused IS NOT NULL THEN
    RAISE EXCEPTION 'rovv_paused' USING ERRCODE = 'P1002';
  END IF;

  /*
   * A video somebody else holds an ELIGIBLE entry for is refused. A pending
   * one does not hold it: entries are public and emails are not verified,
   * so if the first pending entry took the video, a stranger could enter
   * the author's own link under the author's own username before them and
   * lock them out. Both stay in, the console shows they share a video, and
   * the reviewer rules on which is the author's.
   */
  IF EXISTS (
    SELECT 1 FROM rovv_entries
     WHERE campaign_id = v_campaign AND post_key = v_key AND status = 'eligible'
       AND email_canonical <> p_email_canonical
  ) THEN
    RAISE EXCEPTION 'rovv_video_taken' USING ERRCODE = 'P1004';
  END IF;

  -- Twice at most: the second pass is the same person's other tab having
  -- inserted first, which is then a replacement like any other.
  FOR v_pass IN 1..2 LOOP
    SELECT * INTO v_existing FROM rovv_entries
     WHERE campaign_id = v_campaign AND email_canonical = p_email_canonical
     FOR UPDATE;

    IF FOUND THEN
      IF v_existing.tiktok_handle <> p_tiktok_handle OR v_existing.status <> 'pending' THEN
        RAISE EXCEPTION 'rovv_entry_taken' USING ERRCODE = 'P1003';
      END IF;
      -- What a reviewer judges. Only this moves the revision, so fixing the
      -- spelling of an email or the newsletter box never voids a review.
      v_judged := v_existing.post_key = v_key
              AND v_existing.referral_code = p_referral_code
              AND v_existing.full_name = p_full_name;
      entry_id := v_existing.id;
      outcome := CASE
        WHEN v_judged AND v_existing.email = p_email AND v_existing.marketing_opt_in = p_marketing
          THEN 'unchanged'
        ELSE 'updated'
      END;
      UPDATE rovv_entries SET
        full_name = p_full_name,
        email = p_email,
        tiktok_url = p_tiktok_url,
        post_key = v_key,
        revision = v_existing.revision + CASE WHEN v_judged THEN 0 ELSE 1 END,
        referral_code = p_referral_code,
        rules_version = p_rules_version,
        privacy_version = p_privacy_version,
        accepted_at = now(),
        marketing_opt_in = p_marketing,
        marketing_opt_in_at = CASE
          WHEN NOT p_marketing THEN NULL
          WHEN v_existing.marketing_opt_in THEN v_existing.marketing_opt_in_at
          ELSE now()
        END,
        ip_address = p_ip,
        user_agent = p_user_agent,
        updated_at = now()
      WHERE id = v_existing.id;
      RETURN NEXT;
      RETURN;
    END IF;

    BEGIN
      INSERT INTO rovv_entries (
        campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url,
        post_key, referral_code, rules_version, privacy_version,
        marketing_opt_in, marketing_opt_in_at, ip_address, user_agent
      ) VALUES (
        v_campaign, p_full_name, p_email, p_email_canonical, p_tiktok_handle, p_tiktok_url,
        v_key, p_referral_code, p_rules_version, p_privacy_version,
        p_marketing, CASE WHEN p_marketing THEN now() END, p_ip, p_user_agent
      )
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      -- Only the email index can be hit (a new entry is pending, and only an
      -- eligible one holds a video): the same email, entering twice at once.
      -- Round again and take the other request's row as the one to replace.
      v_id := NULL;
    END;

    IF v_id IS NOT NULL THEN
      entry_id := v_id;
      outcome := 'created';
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'rovv_entry_taken' USING ERRCODE = 'P1003';
END $$;

/*
 * A reviewer's call on an entry: eligible, ineligible (with the reason the
 * console shows), or back to pending. A winner stays eligible until an owner
 * unpicks them, so a slip of the hand cannot quietly drop a winner.
 */
CREATE OR REPLACE FUNCTION decide_rovv_entry(
  p_entry    uuid,
  p_status   text,
  p_note     text,
  p_admin_id uuid,
  /* The revision the reviewer was looking at. Entries can be replaced
     until they are reviewed, so a ruling on a version the entrant has
     since replaced would rule on a video nobody watched. */
  p_revision integer
)
RETURNS TABLE (status text, winner boolean)
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
  RETURN NEXT;
END $$;

/*
 * Pick or unpick a winner. Only an eligible entry can win, never more than
 * 20, and a winner who has been emailed stays a winner.
 */
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
      SELECT count(*)::int INTO v_count FROM rovv_entries
       WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL;
      IF v_count >= 20 THEN
        RAISE EXCEPTION 'rovv_winners_full' USING ERRCODE = 'P1009';
      END IF;
      UPDATE rovv_entries SET winner_at = now(), winner_by_admin_id = p_admin_id, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.picked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle));
    END IF;
  ELSE
    IF v_row.notified_at IS NOT NULL THEN
      RAISE EXCEPTION 'rovv_winner_already_told' USING ERRCODE = 'P1010';
    END IF;
    IF v_row.notice_claimed_at > now() - interval '6 minutes' THEN
      RAISE EXCEPTION 'rovv_winner_being_told' USING ERRCODE = 'P1011';
    END IF;
    IF v_row.winner_at IS NOT NULL THEN
      UPDATE rovv_entries SET winner_at = NULL, winner_by_admin_id = NULL, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.unpicked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle));
    END IF;
  END IF;

  SELECT count(*)::int INTO winners FROM rovv_entries
   WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- The purge learns about rovv_entries. Regenerated from 0069, its latest
-- definition, with one block added before the audit log goes.

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

  /*
   * The mail-host cache (0069). Not campaign scoped either, and cleared
   * wholesale for the same reason as the throttle: a row is a domain somebody
   * voted from, and a personal domain names its owner as well as an address
   * would, so a purge that kept it would keep a trace of who voted. The cost
   * is one fresh lookup per domain the next time it votes.
   */
  DELETE FROM vote_domain_mx;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'vote_domain_mx'; rows_deleted := n; RETURN NEXT;

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

  -- Rovv's entries, by campaign, so purging Monica never touches them (0073).
  DELETE FROM rovv_entries WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'rovv_entries'; rows_deleted := n; RETURN NEXT;

  DELETE FROM audit_log WHERE campaign_id = v_campaign;
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  INSERT INTO audit_log (campaign_id, action, entity_type, entity_id, note)
  VALUES (v_campaign, 'campaign.purged', 'campaign', v_campaign,
          'Test data cleared from the database console before launch.');
END $$;


