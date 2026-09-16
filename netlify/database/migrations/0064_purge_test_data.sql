/*
 * Clear the rehearsal data. Launch day, 16 September 2026.
 *
 * Production has carried real testing since the engine was built:
 * registrations, submissions, approved points, referrals, audit rows. The
 * campaign opens to the public today and none of that can be in it. The
 * marketing team confirmed there is nothing worth keeping.
 *
 * Why a migration rather than a console statement: the Netlify CLI's
 * database client does not reach the production branch. A read-only probe
 * against it reported zero admin_users and one challenge, where production
 * necessarily has three admins seeded by 0009 and 0033 and four stages
 * seeded by 0055. Running the purge there would have printed a success
 * table while production kept every test row. A migration is applied by the
 * deploy, against the production branch, which is the difference that
 * matters.
 *
 * This calls purge_campaign_data rather than writing DELETEs, because that
 * function already knows which tables hold people and which hold setup, and
 * the purge test reads every table declaration in this directory and fails
 * if one is in neither list. Hand-written DELETEs would be a second,
 * untested copy of that decision, and the failure that matters is not
 * leaving a row behind: it is taking the setup with it.
 *
 * Kept, by design:
 *   admin_users      every admin profile, both owners and the reviewer,
 *                    each carrying the Netlify Identity binding they sign
 *                    in with. The function never references this table.
 *   admin_sessions   so whoever is signed in is not signed out mid-purge.
 *   campaigns        the row the site looks up by slug on every campaign
 *                    page. Losing it 404s registration on launch morning,
 *                    and migrations apply once, so it would not come back.
 *   challenges       the four stage briefs.
 *   point_rules      the ladder and the award bounds.
 *   resources        admin-edited page copy, nobody's personal data.
 *
 * Purged: every creator, enrolment, entry, submission, social handle,
 * handle change request, point ledger row, referral, vote, vote round,
 * nominee, snapshot, weekly winner, registration attempt, throttle bucket,
 * and this campaign's audit rows.
 *
 * The slug is passed twice deliberately. purge_campaign_data raises P0601
 * unless the confirmation matches, so a line copied into another campaign's
 * migration cannot purge something its author did not name.
 */

SELECT * FROM purge_campaign_data('monica-money-story', 'monica-money-story');
