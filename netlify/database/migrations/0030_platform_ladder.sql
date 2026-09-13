-- The second and third platform are worth less than the first.
--
-- The ladder was linear: 100 for one platform, 200 for two, 300 for three,
-- each platform worth the same 100. That paid the same for the second posting
-- as for the first, and the second posting is not the same work. A creator
-- writes one piece and repurposes it, which is exactly what the campaign asks
-- for and exactly why it should not pay three times over.
--
-- So: 100 for the first platform, 50 for each one after it. One platform is
-- 100, two is 150, three is 200.
--
-- These two rows are the INCREMENT above base_points, not the total, which is
-- how recompute_entry_award reads them:
--
--   1 platform  -> base_points_snapshot                     = 100
--   2 platforms -> base_points_snapshot + bonus_2_snapshot  = 100 + 50
--   3 platforms -> base_points_snapshot + bonus_3_snapshot  = 100 + 100
--
-- Entries already in flight keep the ladder they were created under, because
-- challenge_entries snapshots all three numbers at creation. That is the
-- behaviour we want and not an accident: a creator who entered under the old
-- ladder is paid what they were told they would be paid, and the new ladder
-- applies from the next entry. Pre-launch there are no such rows anyway.

UPDATE point_rules pr
   SET default_points = 50
  FROM campaigns c
 WHERE c.id = pr.campaign_id
   AND c.slug = 'monica-money-story'
   AND pr.key = 'multi_platform_bonus_2';

UPDATE point_rules pr
   SET default_points = 100
  FROM campaigns c
 WHERE c.id = pr.campaign_id
   AND c.slug = 'monica-money-story'
   AND pr.key = 'multi_platform_bonus_3';
