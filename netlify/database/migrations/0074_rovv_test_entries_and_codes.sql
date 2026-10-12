/*
 * Rovv, second pass (the owner, 12 October 2026, the day 0073 shipped).
 *
 * Three things, all on rovv_entries and its functions:
 *
 * 1. Test entries. The owner wants to walk the whole flow before entries
 *    open on the 13th. A signed-in admin can enter with is_test set, at any
 *    time; the window is not checked for them. Test entries never reach the
 *    public page, the exports, the counts or the 20-winner cap, have their
 *    own one-per-email rule so they never block a real entry, and are
 *    deleted in one go (clear_rovv_test_entries).
 *
 * 2. The winner's ticket code. Winners get a BUIDL PASS by registering on
 *    the ticket page with a 100%-off code the team buys, a different code
 *    for each of the 20. The owner pastes the whole list once and it is
 *    handed out one per winner (assign_rovv_ticket_codes), or sets one on a
 *    winner's card; the winner email carries it, so nobody is emailed
 *    without one. A code belongs to one winner, cannot change once their
 *    email has gone, and is cleared if they are unpicked.
 *
 * 3. Fixing a ruled-out entry. Entrants are now emailed the reason when an
 *    entry is ruled ineligible, so they can fix it (a missing tag, the wrong
 *    link) and send it again before the close. An ineligible entry can be
 *    replaced by the same person, and goes back to waiting. An eligible one
 *    still cannot: its video is the one somebody approved.
 *
 * Functions are redefined from 0073, their latest definitions, keeping every
 * rule they raised. New codes P1013 to P1017 (lib/db/errors.ts).
 */

ALTER TABLE rovv_entries
  ADD COLUMN is_test        boolean NOT NULL DEFAULT false,
  ADD COLUMN ticket_code    text,
  /* The ruling the entrant was last emailed, so the same ruling twice (with
     a "back to waiting" between) does not email them twice. Cleared when
     they replace the entry, since a ruling on the new one is news. */
  ADD COLUMN ruling_emailed text;

ALTER TABLE rovv_entries
  ADD CONSTRAINT rovv_entry_code_only_for_winner
    CHECK (ticket_code IS NULL OR winner_at IS NOT NULL),
  ADD CONSTRAINT rovv_entry_code_shape
    CHECK (ticket_code IS NULL OR ticket_code ~ '^[A-Za-z0-9_-]{3,64}$'),
  ADD CONSTRAINT rovv_entry_ruling_emailed
    CHECK (ruling_emailed IS NULL OR ruling_emailed IN ('eligible', 'ineligible'));

/* One real entry per email, and separately one test entry per email, so an
   admin's test with their own address never blocks or replaces anything
   real. */
DROP INDEX rovv_entry_one_per_email;
CREATE UNIQUE INDEX rovv_entry_one_per_email ON rovv_entries (campaign_id, email_canonical)
  WHERE NOT is_test;
CREATE UNIQUE INDEX rovv_entry_one_test_per_email ON rovv_entries (campaign_id, email_canonical)
  WHERE is_test;

/* One eligible real entry per video, as in 0073; a test never holds one. */
DROP INDEX rovv_entry_one_per_video;
CREATE UNIQUE INDEX rovv_entry_one_per_video ON rovv_entries (campaign_id, post_key)
  WHERE status = 'eligible' AND NOT is_test;

/* A code is one person's ticket. Compared without case, in case the ticket
   page reads ABC1 and abc1 as one code. */
CREATE UNIQUE INDEX rovv_entry_one_code ON rovv_entries (campaign_id, upper(ticket_code))
  WHERE ticket_code IS NOT NULL;

/*
 * An entry, a replacement, or a test. p_test is only ever passed true by the
 * route after it has checked the admin session; a test skips the window (not
 * the pause), and never meets a real entry.
 *
 * Replacing: the same email and TikTok username, while the entry is waiting
 * or was ruled out. Replacing a ruled-out entry sends it back to waiting,
 * always as a new revision, even with the same link: the usual fix (adding
 * the missing tag) happens on TikTok and leaves the link as it was.
 */
/*
 * The 0073 signature is kept, as a real entry and nothing else, for the
 * minute between this migration applying and the new code publishing (and
 * for a rollback): the deploy still serving then calls it with twelve
 * arguments, and dropping it would fail every entry in that gap. Defined
 * before the new one, so the function-lineage check reads the full body.
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
BEGIN
  RETURN QUERY SELECT * FROM submit_rovv_entry(
    p_slug, p_full_name, p_email, p_email_canonical, p_tiktok_handle, p_tiktok_url,
    p_referral_code, p_rules_version, p_privacy_version, p_marketing, p_ip, p_user_agent,
    false
  );
END $$;

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
  p_user_agent      text,
  p_test            boolean
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
  v_test      boolean := COALESCE(p_test, false);
  v_existing  rovv_entries%ROWTYPE;
  v_id        uuid;
  v_judged    boolean;
  v_reopened  boolean;
  v_pass      integer;
BEGIN
  SELECT c.id, c.starts_at, c.ends_at, c.status::text, c.paused_at
    INTO v_campaign, v_starts, v_ends, v_status, v_paused
    FROM campaigns c WHERE c.slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_test AND (v_status <> 'active' OR now() < v_starts OR now() > v_ends) THEN
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
   * the reviewer rules on which is the author's. Tests never meet real ones.
   */
  IF NOT v_test AND EXISTS (
    SELECT 1 FROM rovv_entries
     WHERE campaign_id = v_campaign AND post_key = v_key AND status = 'eligible'
       AND NOT is_test AND email_canonical <> p_email_canonical
  ) THEN
    RAISE EXCEPTION 'rovv_video_taken' USING ERRCODE = 'P1004';
  END IF;

  -- Twice at most: the second pass is the same person's other tab having
  -- inserted first, which is then a replacement like any other.
  FOR v_pass IN 1..2 LOOP
    SELECT * INTO v_existing FROM rovv_entries
     WHERE campaign_id = v_campaign AND email_canonical = p_email_canonical
       AND is_test = v_test
     FOR UPDATE;

    IF FOUND THEN
      IF v_existing.tiktok_handle <> p_tiktok_handle OR v_existing.status = 'eligible' THEN
        RAISE EXCEPTION 'rovv_entry_taken' USING ERRCODE = 'P1003';
      END IF;
      v_reopened := v_existing.status = 'ineligible';
      -- What a reviewer judges. Only this (or reopening a ruled-out entry)
      -- moves the revision, so fixing the spelling of an email or the
      -- newsletter box never voids a review in progress.
      v_judged := v_existing.post_key = v_key
              AND v_existing.referral_code = p_referral_code
              AND v_existing.full_name = p_full_name;
      entry_id := v_existing.id;
      outcome := CASE
        WHEN v_judged AND NOT v_reopened
         AND v_existing.email = p_email AND v_existing.marketing_opt_in = p_marketing
          THEN 'unchanged'
        ELSE 'updated'
      END;
      UPDATE rovv_entries SET
        full_name = p_full_name,
        email = p_email,
        tiktok_url = p_tiktok_url,
        post_key = v_key,
        revision = v_existing.revision + CASE WHEN v_judged AND NOT v_reopened THEN 0 ELSE 1 END,
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
        status = 'pending',
        review_note = NULL,
        reviewed_at = NULL,
        reviewed_by_admin_id = NULL,
        ruling_emailed = CASE WHEN v_judged AND NOT v_reopened THEN v_existing.ruling_emailed END,
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
        marketing_opt_in, marketing_opt_in_at, ip_address, user_agent, is_test
      ) VALUES (
        v_campaign, p_full_name, p_email, p_email_canonical, p_tiktok_handle, p_tiktok_url,
        v_key, p_referral_code, p_rules_version, p_privacy_version,
        p_marketing, CASE WHEN p_marketing THEN now() END, p_ip, p_user_agent, v_test
      )
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      -- Only an email index can be hit (a new entry is pending, and only an
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
 * A reviewer's ruling, as in 0073, now also returning what the entry was
 * before, so the route emails the entrant only when the ruling changed.
 */
DROP FUNCTION decide_rovv_entry(uuid, text, text, uuid, integer);

CREATE OR REPLACE FUNCTION decide_rovv_entry(
  p_entry    uuid,
  p_status   text,
  p_note     text,
  p_admin_id uuid,
  /* The revision the reviewer was looking at. Entries can be replaced
     until they are approved, so a ruling on a version the entrant has
     since replaced would rule on a video nobody watched. */
  p_revision integer
)
RETURNS TABLE (status text, winner boolean, previous text)
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
  previous := v_row.status;
  RETURN NEXT;
END $$;

/*
 * Pick or unpick a winner, as in 0073, with two changes: the cap of 20
 * counts real entries only (a test winner never takes a real one's place,
 * and is never refused for want of room), and unpicking clears the ticket
 * code, which belonged to the pick.
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
      IF NOT v_row.is_test THEN
        SELECT count(*)::int INTO v_count FROM rovv_entries
         WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL AND NOT is_test;
        IF v_count >= 20 THEN
          RAISE EXCEPTION 'rovv_winners_full' USING ERRCODE = 'P1009';
        END IF;
      END IF;
      UPDATE rovv_entries SET winner_at = now(), winner_by_admin_id = p_admin_id, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.picked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle, 'test', v_row.is_test));
    END IF;
  ELSE
    IF v_row.notified_at IS NOT NULL THEN
      RAISE EXCEPTION 'rovv_winner_already_told' USING ERRCODE = 'P1010';
    END IF;
    IF v_row.notice_claimed_at > now() - interval '6 minutes' THEN
      RAISE EXCEPTION 'rovv_winner_being_told' USING ERRCODE = 'P1011';
    END IF;
    IF v_row.winner_at IS NOT NULL THEN
      UPDATE rovv_entries
         SET winner_at = NULL, winner_by_admin_id = NULL, ticket_code = NULL, updated_at = now()
       WHERE id = p_entry;
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (v_row.campaign_id, p_admin_id, 'rovv_winner.unpicked', 'rovv_entry', p_entry,
              jsonb_build_object('tiktok_handle', v_row.tiktok_handle, 'test', v_row.is_test));
    END IF;
  END IF;

  SELECT count(*)::int INTO winners FROM rovv_entries
   WHERE campaign_id = v_row.campaign_id AND winner_at IS NOT NULL AND NOT is_test;
  RETURN NEXT;
END $$;

/*
 * Give a winner their ticket code, change it, or clear it (an empty code).
 * Only for a winner, only until their email has gone (or while it is going),
 * and never a code another winner holds. The audit row says it was set, and
 * for whom, but not the code: it is somebody's ticket.
 */
CREATE OR REPLACE FUNCTION set_rovv_ticket_code(
  p_entry    uuid,
  p_code     text,
  p_admin_id uuid
)
RETURNS TABLE (code text)
LANGUAGE plpgsql AS $$
DECLARE
  v_row  rovv_entries%ROWTYPE;
  v_code text := NULLIF(btrim(COALESCE(p_code, '')), '');
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO v_row FROM rovv_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rovv_entry_not_found' USING ERRCODE = 'P1007';
  END IF;
  IF v_row.winner_at IS NULL THEN
    RAISE EXCEPTION 'rovv_code_needs_winner' USING ERRCODE = 'P1014';
  END IF;
  IF v_row.notified_at IS NOT NULL THEN
    RAISE EXCEPTION 'rovv_code_locked' USING ERRCODE = 'P1013';
  END IF;
  IF v_row.notice_claimed_at > now() - interval '6 minutes' THEN
    RAISE EXCEPTION 'rovv_winner_being_told' USING ERRCODE = 'P1011';
  END IF;
  IF v_code IS NOT NULL AND v_code !~ '^[A-Za-z0-9_-]{3,64}$' THEN
    RAISE EXCEPTION 'rovv_bad_code' USING ERRCODE = 'P1016';
  END IF;
  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM rovv_entries
     WHERE campaign_id = v_row.campaign_id AND upper(ticket_code) = upper(v_code) AND id <> p_entry
  ) THEN
    RAISE EXCEPTION 'rovv_code_taken' USING ERRCODE = 'P1015';
  END IF;

  UPDATE rovv_entries SET ticket_code = v_code, updated_at = now() WHERE id = p_entry;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
  VALUES (v_row.campaign_id, p_admin_id,
          CASE WHEN v_code IS NULL THEN 'rovv_code.cleared' ELSE 'rovv_code.set' END,
          'rovv_entry', p_entry,
          jsonb_build_object('tiktok_handle', v_row.tiktok_handle, 'test', v_row.is_test));

  code := v_code;
  RETURN NEXT;
END $$;

/* Delete every test entry, so the owner can walk the flow again. */
CREATE OR REPLACE FUNCTION clear_rovv_test_entries(p_slug text, p_admin_id uuid)
RETURNS TABLE (deleted integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM rovv_entries WHERE campaign_id = v_campaign AND is_test;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
  VALUES (v_campaign, p_admin_id, 'rovv.test_cleared', 'campaign', v_campaign,
          jsonb_build_object('rows', deleted));
  RETURN NEXT;
END $$;

/*
 * Hand out a pasted list of ticket codes, one per winner (the owner, 12
 * October: the team buys 20 different codes and pastes them all at once).
 *
 * In the order the winners were picked, to every winner of the given kind
 * (real or test, never mixed) who has no code, has not been emailed and is
 * not being emailed. A list with a code in it twice, a code of the wrong
 * shape, or a code a winner already holds is refused whole, so a code can
 * never reach two people. More codes than winners leaves the rest unused;
 * fewer leaves the last winners waiting for theirs. Returns who got which.
 * Under the campaign row's lock, like picking, so a pick or another paste
 * cannot interleave.
 */
CREATE OR REPLACE FUNCTION assign_rovv_ticket_codes(
  p_slug     text,
  p_codes    text[],
  p_test     boolean,
  p_admin_id uuid
)
RETURNS TABLE (entry_id uuid, handle text, code text)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_codes    text[];
  v_i        integer := 0;
  v_row      record;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM campaigns WHERE id = v_campaign FOR NO KEY UPDATE;

  SELECT COALESCE(array_agg(btrim(c) ORDER BY n), '{}')
    INTO v_codes
    FROM unnest(p_codes) WITH ORDINALITY AS t(c, n)
   WHERE btrim(c) <> '';

  IF EXISTS (SELECT 1 FROM unnest(v_codes) AS c WHERE c !~ '^[A-Za-z0-9_-]{3,64}$') THEN
    RAISE EXCEPTION 'rovv_bad_code' USING ERRCODE = 'P1016';
  END IF;
  IF (SELECT count(*) FROM unnest(v_codes)) <> (SELECT count(DISTINCT upper(c)) FROM unnest(v_codes) AS c) THEN
    RAISE EXCEPTION 'rovv_codes_repeated' USING ERRCODE = 'P1017';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rovv_entries e
     WHERE e.campaign_id = v_campaign
       AND upper(e.ticket_code) IN (SELECT upper(c) FROM unnest(v_codes) AS c)
  ) THEN
    RAISE EXCEPTION 'rovv_code_taken' USING ERRCODE = 'P1015';
  END IF;

  FOR v_row IN
    SELECT e.id AS wid, e.tiktok_handle AS whandle
      FROM rovv_entries e
     WHERE e.campaign_id = v_campaign
       AND e.is_test = COALESCE(p_test, false)
       AND e.winner_at IS NOT NULL
       AND e.notified_at IS NULL
       AND e.ticket_code IS NULL
       AND (e.notice_claimed_at IS NULL OR e.notice_claimed_at <= now() - interval '6 minutes')
     ORDER BY e.winner_at, e.id
     FOR UPDATE
  LOOP
    EXIT WHEN v_i >= coalesce(array_length(v_codes, 1), 0);
    v_i := v_i + 1;
    UPDATE rovv_entries SET ticket_code = v_codes[v_i], updated_at = now() WHERE id = v_row.wid;
    entry_id := v_row.wid;
    handle := v_row.whandle;
    code := v_codes[v_i];
    RETURN NEXT;
  END LOOP;

  -- How many went, never which codes: they are people's tickets.
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
  VALUES (v_campaign, p_admin_id, 'rovv_code.assigned', 'campaign', v_campaign,
          jsonb_build_object('assigned', v_i, 'pasted', coalesce(array_length(v_codes, 1), 0),
                             'test', COALESCE(p_test, false)));
END $$;
