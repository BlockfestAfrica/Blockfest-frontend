-- Promote marketing@blockfestafrica.com from reviewer to owner.
--
-- The owner asked for marketing to have the same rights as
-- heedris2olubisi@gmail.com, which is the owner role: announcing winners
-- with prize amounts, pausing the campaign, editing the weekly briefs and
-- point values, repricing entries and editing pack resources.
--
-- A new migration rather than an edit to 0033, which seeded the account as
-- reviewer: applied migrations are immutable, and Netlify rejects a
-- checksum change as drift.
--
-- Role is read live from this table on every request, so this takes effect
-- on marketing's next click with no sign-out needed.

UPDATE admin_users
SET role = 'owner'
WHERE email_canonical = 'marketing@blockfestafrica.com';
