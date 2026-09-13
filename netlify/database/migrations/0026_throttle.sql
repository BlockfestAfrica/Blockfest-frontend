-- A rate limit that survives more than one function instance.
--
-- lib/admin/request.ts has carried throttleKey since it was written, with a
-- careful comment about why x-forwarded-for is not safe to key on, and nothing
-- ever called it. There was no limiter behind it. So registration, the entry
-- link and every admin route have been unthrottled, which is what turns the
-- registration oracle from a curiosity into an enumeration: the route says
-- "that email is taken" and "that phone is taken" in different words, Nigerian
-- mobile numbers are a small enough space to walk, and nothing slowed anybody
-- down.
--
-- In the database rather than in memory, because the functions are serverless.
-- A counter in a module variable is per instance, resets on every cold start,
-- and gives an attacker a fresh budget by waiting. It would read as a rate
-- limit in review and do nothing in production, which is worse than none.
--
-- A fixed window, not a sliding one. A sliding window needs either a row per
-- request or a background sweep, and a fixed window's known weakness, twice the
-- budget across a boundary, does not matter for limits whose job is to make
-- enumeration slow rather than impossible.

CREATE TABLE IF NOT EXISTS "request_throttle" (
  "bucket"       text        NOT NULL,
  "window_start" timestamptz NOT NULL,
  "hits"         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY ("bucket", "window_start")
);

-- Old windows are dead weight the moment their window passes.
CREATE INDEX IF NOT EXISTS "request_throttle_window"
  ON "request_throttle" ("window_start");

-- ---------------------------------------------------------------------------
-- Take one token. True means allowed.
--
-- One statement, so two concurrent requests cannot both read a count below the
-- limit and both pass. The INSERT is the read: ON CONFLICT DO UPDATE returns
-- the incremented value under the row lock the upsert already holds.

CREATE OR REPLACE FUNCTION take_token(
  p_bucket  text,
  p_limit   integer,
  p_seconds integer
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_window timestamptz;
  v_hits   integer;
BEGIN
  IF p_bucket IS NULL OR btrim(p_bucket) = '' THEN
    -- No key means no throttling rather than one shared bucket. A shared
    -- bucket would have every visitor spending the same budget, so on launch
    -- morning the campaign would rate limit itself.
    RETURN true;
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / GREATEST(p_seconds, 1)) * GREATEST(p_seconds, 1)
  );

  INSERT INTO request_throttle (bucket, window_start, hits)
  VALUES (btrim(p_bucket), v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET hits = request_throttle.hits + 1
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup, on roughly one call in fifty, so the table does not
  -- need a scheduled job to stay small. Cheap, indexed, and never on the path
  -- of the request that is being answered.
  IF v_hits % 50 = 0 THEN
    DELETE FROM request_throttle
     WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= GREATEST(p_limit, 1);
END $$;


-- ---------------------------------------------------------------------------
-- The purge learns about the new table.
--
-- Regenerated from 0021, its latest definition. A table holding anything
-- derived from a person has to be in the purge or in the KEEP list with a
-- reason, and purge.test.ts fails the build if it is in neither.

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

  GET DIAGNOSTICS n = ROW_COUNT; table_name := 'votes'; rows_deleted := n; RETURN NEXT;

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
