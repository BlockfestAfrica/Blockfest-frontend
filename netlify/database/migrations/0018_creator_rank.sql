-- One definition of the order, and a rank lookup that no limit can hide.
--
-- creator_rank existed in application code as a query wrapped around
-- campaign_leaderboard(slug, 100000), on the stated reasoning that a large
-- limit meant nobody could fall outside it. The function clamps:
--
--   LIMIT greatest(1, least(COALESCE(p_limit, 100), 500))
--
-- so 100000 was silently 500, and a creator ranked 501st got no row back. The
-- page renders a missing rank as "Not ranked yet", which is what somebody with
-- no approved entries sees, so the 501st creator in a campaign built to attract
-- thousands would have been told they had not started.
--
-- The test that was supposed to cover this created twelve creators, so five
-- hundred was never anywhere near the limit and it passed while proving
-- nothing about the thing it was named after.
--
-- The fix is not a bigger number. campaign_ranked returns the whole ordering
-- with no limit at all, campaign_leaderboard becomes that plus a LIMIT, and
-- creator_rank becomes that plus a WHERE. The tiebreak the rules publish,
-- "who reached that total first", is then written once: two copies of it would
-- only have to disagree once for a creator's own page and the public board to
-- name different leaders.

CREATE OR REPLACE FUNCTION campaign_ranked(p_campaign_slug text)
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
  ORDER BY rank;
$$;

-- The published board: the same order, cut to a page.
--
-- Same signature, so this replaces the existing function rather than creating
-- an overload. The cap stays, and it is the right thing for a page anybody can
-- load: it is the reason creator_rank could not be built on it.
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
  SELECT * FROM campaign_ranked(p_campaign_slug)
   ORDER BY rank
   LIMIT greatest(1, least(COALESCE(p_limit, 100), 500));
$$;

-- One creator's standing, for their own page.
--
-- Returns NULL for somebody with no points, who is genuinely not ranked yet,
-- and for a suspended creator, who is off the board. Both are absent from
-- campaign_ranked for the same reason the public board omits them. What it no
-- longer returns NULL for is somebody who is simply a long way down.
CREATE OR REPLACE FUNCTION creator_rank(
  p_campaign_slug text,
  p_enrolment     uuid
)
RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT rank FROM campaign_ranked(p_campaign_slug)
   WHERE campaign_creator_id = p_enrolment;
$$;
