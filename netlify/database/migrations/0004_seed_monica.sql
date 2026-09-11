-- The Monica campaign row, and the point values entries will snapshot.
--
-- Seeded as a migration rather than inserted by hand, because the registration
-- endpoint resolves the campaign by slug on every request and cannot serve
-- anybody without it. A row somebody has to remember to insert is a row that is
-- missing the first time any database is created, and that includes every
-- deploy preview branch, not just production.
--
-- status is 'active' and starts_at is the real opening moment. The endpoint
-- gates on both, so seeding this ahead of time does not open entries early: the
-- date holds them shut until 14 September and then opens them on its own,
-- without anybody touching the database on launch day.

INSERT INTO campaigns (slug, name, tagline, status, starts_at, ends_at, timezone)
VALUES (
  'monica-money-story',
  'Monica: The Money Story',
  'Are you skillful?',
  'active',
  '2026-09-14 00:00:00+01',
  '2026-10-17 23:59:59+01',
  'Africa/Lagos'
)
ON CONFLICT (slug) DO NOTHING;

-- The ladder, in the form the engine consumes.
--
-- recompute_entry_award adds bonus_2 to the base for two platforms and bonus_3
-- to the base for three, so these are gaps from the base rather than a running
-- total: 100, then 100 more to reach 200, then 200 more to reach 300. Storing
-- them any other way would award 400 for three platforms.
--
-- min_points and max_points stay null deliberately. They bound what an admin
-- may award by hand, and none of these three keys is ever awarded by hand: the
-- engine computes them. Inventing bounds for values nothing manual can reach
-- would read as a safety check while enforcing nothing.
INSERT INTO point_rules (campaign_id, key, default_points)
SELECT c.id, v.key, v.points
FROM campaigns c
CROSS JOIN (VALUES
  ('entry_base',             100),
  ('multi_platform_bonus_2', 100),
  ('multi_platform_bonus_3', 200)
) AS v(key, points)
WHERE c.slug = 'monica-money-story'
ON CONFLICT (campaign_id, key) DO NOTHING;
