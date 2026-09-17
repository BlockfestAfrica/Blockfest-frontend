-- The marketing point system, made true in the rules the engine reads.
--
-- The team's published table and the database disagreed on three values:
-- Featured by Blockfest paid a default of 100 against a published 50,
-- a wildcard win defaulted to 200 with a 600 cap against a published flat
-- 100, and the quality and engagement bonuses were capped at 300 against
-- published ranges ending at 200. The published numbers win: they are what
-- creators were told.
--
-- In-flight entries and awards: none of these rules snapshot onto entries,
-- manual awards read their bounds at award time, and every bonus already
-- awarded stands as its ledger row, exactly as the published adjustment
-- clause promises. Only awards made after this applies feel the new
-- defaults and ceilings.

UPDATE point_rules pr SET default_points = 50, max_points = 50
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'featured_blockfest';

UPDATE point_rules pr SET default_points = 100, max_points = 100
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'featured_monica';

UPDATE point_rules pr SET default_points = 100, max_points = 100
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'wildcard_win';

UPDATE point_rules pr SET default_points = 50, max_points = 200
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'quality_bonus';

-- The tier ladder starts at 20 for 5K views; the default follows it.
UPDATE point_rules pr SET default_points = 20, max_points = 200
  FROM campaigns c
 WHERE c.id = pr.campaign_id AND c.slug = 'monica-money-story'
   AND pr.key = 'engagement_milestone';
