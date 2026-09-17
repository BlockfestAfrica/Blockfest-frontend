-- Weekly standings that cannot be recomputed, and winners that cannot repeat.
--
-- 3,400,000 naira rides on final positions and 1,600,000 on weekly prizes, so
-- both of these are about being able to answer a question in October about what
-- was true in September.

-- ---------------------------------------------------------------------------
-- 1. Snapshots.
--
-- campaign_leaderboard is a live query over a ledger that keeps moving. Ask it
-- in October what the standings were on 19 September and it cannot tell you: an
-- approval backdated by a late review, a correction, a disqualification all
-- change the answer retrospectively. This is the only record of a week that
-- survives the week.
--
-- Denormalised on purpose. display_name is copied rather than joined, because a
-- snapshot has to still read correctly after a creator is removed, renamed, or
-- purged. A snapshot that needs a live row to render is not a record.
--
-- Append-only, enforced by triggers rather than by convention: the whole value
-- of this table is that nobody can quietly adjust last week.

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  week_no             smallint NOT NULL,
  /*
   * Re-taking a week makes a new version rather than replacing the old one.
   * The issue allows refusing instead, but versioning answers a better
   * question: it shows that somebody re-took it, and when, which a refusal
   * hides. Version 1 is the one published unless somebody says otherwise.
   */
  version             smallint NOT NULL DEFAULT 1,
  rank                integer NOT NULL,
  campaign_creator_id uuid REFERENCES campaign_creators(id) ON DELETE SET NULL,
  display_name        text NOT NULL,
  points_total        integer NOT NULL,
  approved_entries    integer NOT NULL,
  taken_at            timestamptz NOT NULL DEFAULT now(),
  taken_by_admin_id   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT snapshot_week_range CHECK (week_no BETWEEN 1 AND 4),
  CONSTRAINT snapshot_rank_positive CHECK (rank > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS snapshot_one_rank_per_version
  ON leaderboard_snapshots (campaign_id, week_no, version, rank);

CREATE INDEX IF NOT EXISTS snapshot_by_week
  ON leaderboard_snapshots (campaign_id, week_no, version);

CREATE OR REPLACE FUNCTION refuse_snapshot_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'leaderboard_snapshots is append-only: a week that can be edited afterwards is not a record of that week. Take a new version instead.'
    USING ERRCODE = 'P0701';
END $$;

DROP TRIGGER IF EXISTS snapshot_no_update ON leaderboard_snapshots;
CREATE TRIGGER snapshot_no_update
  BEFORE UPDATE ON leaderboard_snapshots
  FOR EACH ROW EXECUTE FUNCTION refuse_snapshot_change();

DROP TRIGGER IF EXISTS snapshot_no_delete ON leaderboard_snapshots;
CREATE TRIGGER snapshot_no_delete
  BEFORE DELETE ON leaderboard_snapshots
  FOR EACH ROW EXECUTE FUNCTION refuse_snapshot_change();

-- The purge is the one thing allowed to clear them, and it has to be, because
-- it clears the creators they point at. It runs as the table owner, so it needs
-- an explicit way past the triggers rather than an exception in them.
CREATE OR REPLACE FUNCTION purge_snapshots(p_campaign uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  ALTER TABLE leaderboard_snapshots DISABLE TRIGGER snapshot_no_delete;
  DELETE FROM leaderboard_snapshots WHERE campaign_id = p_campaign;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE leaderboard_snapshots ENABLE TRIGGER snapshot_no_delete;
  RETURN n;
END $$;

/**
 * Freeze the standings for a week.
 *
 * Reads campaign_ranked, which is the same ordering the public board and a
 * creator's own rank use, so a snapshot cannot disagree with what people saw.
 */
CREATE OR REPLACE FUNCTION take_leaderboard_snapshot(
  p_campaign_slug text,
  p_week_no       smallint,
  p_admin         uuid
)
RETURNS TABLE (version smallint, rows_captured integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_version  smallint;
  n          integer;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(max(s.version), 0) + 1 INTO v_version
    FROM leaderboard_snapshots s
   WHERE s.campaign_id = v_campaign AND s.week_no = p_week_no;

  INSERT INTO leaderboard_snapshots (
    campaign_id, week_no, version, rank, campaign_creator_id,
    display_name, points_total, approved_entries, taken_by_admin_id
  )
  SELECT v_campaign, p_week_no, v_version, r.rank, r.campaign_creator_id,
         r.display_name, r.points_total, r.approved_entries, p_admin
    FROM campaign_ranked(p_campaign_slug) r;

  GET DIAGNOSTICS n = ROW_COUNT;

  -- An empty snapshot is a fact about the week, not a failure, and recording it
  -- is better than leaving a gap somebody later reads as "nobody took one".
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin, 'leaderboard.snapshot', 'campaign', v_campaign,
    jsonb_build_object('week_no', p_week_no, 'version', v_version, 'rows', n),
    format('Week %s standings frozen, version %s, %s creators.',
           p_week_no, v_version, n)
  );

  version := v_version;
  rows_captured := n;
  RETURN NEXT;
END $$;

-- The purge has to clear snapshots, because it clears the creators they point
-- at. Added to purge_campaign_data here rather than left for later: the
-- completeness test refuses any table that is in neither list, which is what
-- caught this one.
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

-- ---------------------------------------------------------------------------
-- 2. Publishing a weekly winner.
--
-- The database already carried both rules, from the first migration:
--
--   one_winner_per_category_per_week    UNIQUE (campaign_id, week_no, category)
--   creator_of_week_once_per_campaign   UNIQUE (campaign_id, campaign_creator_id)
--                                       WHERE category = 'creator_of_week'
--
-- Community Favourite sits outside the second one deliberately: the brief
-- restricts only Creator of the Week, and somebody whose work the audience
-- loves twice should be able to win it twice.
--
-- What was missing is a way to write the row that surfaces those rules as
-- sentences rather than as constraint names, and that records who decided.
--
-- Nothing is public until published_at is set, so a draft can be chosen on the
-- Saturday and announced on the Sunday without the site giving it away.

CREATE OR REPLACE FUNCTION publish_weekly_winner(
  p_campaign_slug text,
  p_week_no       smallint,
  p_category      winner_category,
  p_enrolment     uuid,
  p_entry         uuid,
  p_prize_naira   integer,
  p_note          text,
  p_admin         uuid,
  p_publish       boolean
)
RETURNS TABLE (winner_id uuid, published boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign uuid;
  v_id       uuid;
  v_when     timestamptz := CASE WHEN p_publish THEN now() ELSE NULL END;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;

  SELECT id INTO v_campaign FROM campaigns WHERE slug = p_campaign_slug;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM campaign_creators
   WHERE id = p_enrolment AND campaign_id = v_campaign;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  BEGIN
    INSERT INTO weekly_winners (
      campaign_id, week_no, category, campaign_creator_id, entry_id,
      prize_amount_naira, note, published_at
    ) VALUES (
      v_campaign, p_week_no, p_category, p_enrolment, p_entry,
      p_prize_naira, NULLIF(btrim(COALESCE(p_note, '')), ''), v_when
    )
    ON CONFLICT (campaign_id, week_no, category) DO UPDATE
      SET campaign_creator_id = EXCLUDED.campaign_creator_id,
          entry_id            = EXCLUDED.entry_id,
          prize_amount_naira  = EXCLUDED.prize_amount_naira,
          note                = EXCLUDED.note,
          published_at        = EXCLUDED.published_at
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The only index left that this can violate. Named, because "duplicate
      -- key value violates unique constraint" tells the admin nothing about
      -- which rule they met or why it exists.
      RAISE EXCEPTION 'already_creator_of_week' USING ERRCODE = 'P0801';
  END;

  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, p_admin,
    CASE WHEN p_publish THEN 'winner.published' ELSE 'winner.drafted' END,
    'weekly_winner', v_id,
    jsonb_build_object(
      'week_no', p_week_no,
      'category', p_category::text,
      'campaign_creator_id', p_enrolment,
      'prize_amount_naira', p_prize_naira
    ),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  winner_id := v_id;
  published := p_publish;
  RETURN NEXT;
END $$;

/**
 * Who may still win Creator of the Week.
 *
 * The second of the three enforcements the brief asks for. The index refuses a
 * repeat, this stops one being offered, and the screen says why the name is
 * missing. Leaving it to a note in a runbook for a tired admin on a Sunday
 * night is not enforcement.
 *
 * Ordered by the same ranking as everything else, so the obvious candidate is
 * at the top.
 */
CREATE OR REPLACE FUNCTION weekly_winner_candidates(
  p_campaign_slug text,
  p_category      winner_category
)
RETURNS TABLE (
  campaign_creator_id uuid,
  display_name        text,
  points_total        integer,
  approved_entries    integer,
  rank                bigint
)
LANGUAGE sql STABLE AS $$
  SELECT r.campaign_creator_id, r.display_name, r.points_total,
         r.approved_entries, r.rank
    FROM campaign_ranked(p_campaign_slug) r
   WHERE p_category <> 'creator_of_week'
      OR NOT EXISTS (
        SELECT 1
          FROM weekly_winners w
          JOIN campaigns c ON c.id = w.campaign_id
         WHERE c.slug = p_campaign_slug
           AND w.category = 'creator_of_week'
           AND w.campaign_creator_id = r.campaign_creator_id
      )
   ORDER BY r.rank;
$$;
