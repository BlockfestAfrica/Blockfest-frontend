/*
 * The 30-day, four-stage restructure. The team's brief of 15 September is
 * the source of truth and replaces the five-stage plan:
 *
 *   The launch moved from Monday 14 to Wednesday 16 September. The
 *   campaign is now positioned as a 30-Day Creator Challenge, 16 September
 *   to 17 October, final results 18 October. Four stages, not five.
 *
 *   Stage 1  The Discovery   16 - 24 September, closes Thursday 24th at
 *                            23:59 Lagos (the launch-stage exception:
 *                            nine days, a Thursday close)
 *   Stage 2                  28 September - 3 October, closes Saturday
 *                            at 12:00 noon Lagos
 *   Stage 3                  5 - 10 October, closes Saturday 12:00 noon
 *   Stage 4                  12 - 17 October, closes Saturday 12:00 noon
 *
 * From stage 2 the cadence is: challenge drops Monday, create and submit
 * through Saturday noon, results Sunday. The Sundays between stages are
 * already how the engine works; only the windows move.
 *
 * DML, not console edits, per the house rule that production data changes
 * travel as migrations. The week 1 description is deliberately not touched:
 * the team already wrote the Make Them Curious brief into the console and
 * this must not overwrite their words. Weeks 2 to 4 keep their draft
 * status and placeholder titles for the team to replace when each drops.
 *
 * Week 5, the old finale, is retired. It was a draft, the four-stage plan
 * has no fifth window, and the weekly prize pool was always described as
 * four rounds, so nothing money-shaped changes. The DELETE is guarded on
 * the row having no entries: if anything was ever filed against it, the
 * migration must fail loudly rather than orphan work.
 */

UPDATE campaigns
   SET starts_at = '2026-09-16 00:00:00+01'
 WHERE slug = 'monica-money-story';

UPDATE challenges ch SET
  starts_at = v.starts_at::timestamptz,
  ends_at   = v.ends_at::timestamptz
FROM campaigns c, (VALUES
  (1::smallint, '2026-09-16 00:00:00+01', '2026-09-24 23:59:59+01'),
  (2::smallint, '2026-09-28 00:00:00+01', '2026-10-03 12:00:00+01'),
  (3::smallint, '2026-10-05 00:00:00+01', '2026-10-10 12:00:00+01'),
  (4::smallint, '2026-10-12 00:00:00+01', '2026-10-17 12:00:00+01')
) AS v(week_no, starts_at, ends_at)
WHERE c.id = ch.campaign_id
  AND c.slug = 'monica-money-story'
  AND ch.week_no = v.week_no;

-- Refuse to retire a finale that somehow holds work. An entry against
-- week 5 would mean the plan and the data disagree, and a migration is
-- the wrong place to decide who wins that argument.
DO $$
DECLARE
  v_entries integer;
BEGIN
  SELECT count(*) INTO v_entries
    FROM challenge_entries ce
    JOIN challenges ch ON ch.id = ce.challenge_id
    JOIN campaigns c   ON c.id = ch.campaign_id
   WHERE c.slug = 'monica-money-story' AND ch.week_no = 5;

  IF v_entries > 0 THEN
    RAISE EXCEPTION 'week 5 holds % entries; retire it by hand after deciding where they go', v_entries;
  END IF;

  DELETE FROM challenges ch
   USING campaigns c
   WHERE c.id = ch.campaign_id
     AND c.slug = 'monica-money-story'
     AND ch.week_no = 5;
END $$;
