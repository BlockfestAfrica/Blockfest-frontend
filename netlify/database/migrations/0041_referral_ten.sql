-- Referral drops from 50 points to 10, the campaign team's decision from
-- the updated marketing doc, applied on day one of the campaign.
--
-- The payout function reads default_points live at award time, so this
-- changes every payout from the moment it applies. Referrals already paid
-- at 50 stand: the ledger is append-only, and the published rules say a
-- rate change never restates what was already earned. The clawback path
-- reverses whatever the original ledger row says, so a 50-point referral
-- claws back 50 and a 10-point one claws back 10.

UPDATE point_rules pr
   SET default_points = 10
  FROM campaigns c
 WHERE c.id = pr.campaign_id
   AND c.slug = 'monica-money-story'
   AND pr.key = 'referral';
