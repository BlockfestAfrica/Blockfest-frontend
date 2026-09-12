-- The public leaderboard, ranked the way the rules actually promise.
--
-- The rules say: "The final leaderboard is settled on total points. Where
-- creators are level, the order is decided by who reached that total first,
-- then by the number of approved entries, and then at our discretion."
--
-- "Who reached that total first" is not first_approved_at. That is when somebody
-- had their first approved entry, which for two creators level on 300 points
-- says nothing about who got to 300 first. Using it would have been a plausible
-- reading of a field that already existed, and a quiet breach of a published
-- rule that decides money.
--
-- The ledger is append-only with a timestamp on every row, so the real question
-- is answerable: replay each creator's running total in order and take the
-- moment it first reached the value they hold now. A later correction that takes
-- points away and gives them back does not move that moment, because the total
-- was already there earlier.
--
-- Ordering is total DESC, then that moment ASC, then approved entries DESC.
-- The fourth step in the rules is "at our discretion", which is a human
-- decision and deliberately has no implementation: ties that survive three
-- levels are rare and should be looked at, not resolved by whatever id sorts
-- first.

CREATE OR REPLACE FUNCTION campaign_leaderboard(
  p_campaign_slug text,
  p_limit         integer DEFAULT 100
)
RETURNS TABLE (
  rank             bigint,
  campaign_creator_id uuid,
  display_name     text,
  points_total     integer,
  approved_entries integer,
  reached_total_at timestamp with time zone
)
LANGUAGE sql STABLE AS $$
  WITH enrolled AS (
    SELECT cc.id, cc.points_total, cc.approved_entries_count, c.full_name
      FROM campaign_creators cc
      JOIN creators c   ON c.id = cc.creator_id
      JOIN campaigns cm ON cm.id = cc.campaign_id
     WHERE cm.slug = p_campaign_slug
       AND cc.status = 'active'
       AND cc.points_total > 0
  ),
  running AS (
    -- Every creator's total after each ledger row, in order.
    SELECT
      pl.campaign_creator_id,
      pl.created_at,
      sum(pl.points) OVER (
        PARTITION BY pl.campaign_creator_id
        ORDER BY pl.created_at, pl.id
        ROWS UNBOUNDED PRECEDING
      ) AS running_total
      FROM point_ledger pl
      JOIN enrolled e ON e.id = pl.campaign_creator_id
  ),
  reached AS (
    -- The first moment that running total equalled what they hold now.
    SELECT r.campaign_creator_id, min(r.created_at) AS reached_at
      FROM running r
      JOIN enrolled e
        ON e.id = r.campaign_creator_id
       AND r.running_total = e.points_total
     GROUP BY r.campaign_creator_id
  )
  SELECT
    row_number() OVER (
      ORDER BY e.points_total DESC,
               COALESCE(rc.reached_at, 'infinity'::timestamptz) ASC,
               e.approved_entries_count DESC
    ) AS rank,
    e.id,
    e.full_name,
    e.points_total,
    e.approved_entries_count,
    rc.reached_at
  FROM enrolled e
  LEFT JOIN reached rc ON rc.campaign_creator_id = e.id
  ORDER BY rank
  LIMIT greatest(1, least(COALESCE(p_limit, 100), 500));
$$;
