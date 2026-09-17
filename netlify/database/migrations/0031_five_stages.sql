-- Five stages, Monday to Saturday, with the Sunday kept clear.
--
-- 0008 seeded four challenges running Monday to Sunday, the last one stretching
-- twelve days to cover the rest of the campaign. The published dates are now:
--
--   Stage 1   14 - 19 September
--   Stage 2   21 - 26 September
--   Stage 3   28 September - 3 October
--   Stage 4    5 - 10 October
--   Stage 5   12 - 17 October
--
-- Two things change. Each window now closes on the Saturday rather than running
-- through Sunday, which leaves the Sunday between stages for reviewing the
-- week's entries and announcing the weekly winners. A stage no longer ends on
-- the day its own result is published, and the site no longer says Saturday in
-- one place and Sunday in another.
--
-- And the long final stretch becomes its own stage. This is the shape
-- db/schema.ts has documented since the first migration: "week_no 1..5, four
-- full weeks carrying the four weekly prizes, then a final stretch which is the
-- final challenge and carries no weekly prize". The seed only ever created four.
--
-- stage is NULL on week 5, deliberately and not as an oversight:
-- challenge_stage_range caps it at 4, and the schema's own note says the final
-- challenge carries no stage number because it is not one of the four weekly
-- rounds. week_no is what orders it; stage is what marks a weekly round.
--
-- Stage 4 is new and its title is a placeholder the campaign team should
-- replace. The names run Discovery, Problem, Solution, Proof, Money Story;
-- "The Proof" is the step that was missing, not a name anybody signed off.

UPDATE challenges ch SET
  starts_at = v.starts_at::timestamptz,
  ends_at   = v.ends_at::timestamptz,
  title     = v.title,
  description = v.description
FROM campaigns c, (VALUES
  (1::smallint, 'The Discovery',
   'Who is Monica? Introduce Monica to your audience and make the brand understandable.',
   '2026-09-14 00:00:00+01', '2026-09-19 23:59:59+01'),
  (2::smallint, 'The Problem',
   'Why is money still this complicated? Tell real or relatable stories about financial friction: the fees, the waiting, the rates.',
   '2026-09-21 00:00:00+01', '2026-09-26 23:59:59+01'),
  (3::smallint, 'The Solution',
   'There is a better way. Explore stablecoins, digital finance and what Monica is actually building.',
   '2026-09-28 00:00:00+01', '2026-10-03 23:59:59+01'),
  (4::smallint, 'The Proof',
   'Show it working. Make it concrete: what changes for somebody who actually uses it.',
   '2026-10-05 00:00:00+01', '2026-10-10 23:59:59+01')
) AS v(week_no, title, description, starts_at, ends_at)
WHERE c.id = ch.campaign_id
  AND c.slug = 'monica-money-story'
  AND ch.week_no = v.week_no;

-- The finale, which 0008 never created.
INSERT INTO challenges (
  campaign_id, title, description, week_no, stage, status, starts_at, ends_at, base_points
)
SELECT
  c.id,
  'The Money Story',
  'Tell Monica''s story your way. Maximum creative freedom, and your strongest single piece of work.',
  5::smallint,
  NULL,
  'active'::challenge_status,
  '2026-10-12 00:00:00+01'::timestamptz,
  '2026-10-17 23:59:59+01'::timestamptz,
  100
FROM campaigns c
WHERE c.slug = 'monica-money-story'
  AND NOT EXISTS (
    SELECT 1 FROM challenges ch
     WHERE ch.campaign_id = c.id AND ch.week_no = 5
  );
