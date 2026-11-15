/*
 * One-off emails to the creators who said yes to future campaigns
 * (lib/admin/broadcast.ts).
 *
 * The first is Monica's ₦50 million Creator Challenge, which Monica asked
 * the team to tell its creators about after the campaign closed. Every
 * other bulk send rides on a campaign event (a stage opening, a vote, a
 * result); this one rides on nothing, so it needs its own record of who
 * has had it.
 *
 * One row per recipient per broadcast, the same shape as the ROVV results
 * email (0075). claimed_at is a press's hold on one recipient, taken just
 * before their mail and dropped if it fails (and treated as abandoned after
 * six minutes, longer than a press runs); sent_at is set only for a mail
 * that left, so a press cut short strands nobody and nobody gets it twice.
 *
 * stop_token_hash is the SHA-256 of the token in that mail's "stop these
 * emails" link. The privacy notice promises every future-campaigns email
 * carries a way to stop them. Hashed like every other token here, so the
 * database alone cannot stop anybody's mail.
 */
CREATE TABLE IF NOT EXISTS broadcast_sends (
  broadcast       text        NOT NULL,
  creator_id      uuid        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  stop_token_hash text,
  PRIMARY KEY (broadcast, creator_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS broadcast_sends_stop_token_key
  ON broadcast_sends (stop_token_hash)
  WHERE stop_token_hash IS NOT NULL;

/*
 * The purge, from 0073 unchanged except that it now clears broadcast_sends
 * for the creators it deletes. Those rows would go with the creators anyway
 * (ON DELETE CASCADE), but the purge reports what it removed table by table,
 * and a table it removes silently is a table missing from that report.
 */
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

  -- Who was sent a one-off email, for the creators about to go (0076).
  DELETE FROM broadcast_sends WHERE creator_id IN (SELECT creator_id FROM purge_orphans);
  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'broadcast_sends'; rows_deleted := n; RETURN NEXT;

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
