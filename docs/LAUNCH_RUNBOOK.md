# Launch runbook

Monica: The Money Story opens **Monday 14 September 2026, 00:00 Africa/Lagos**.

## Clear the test data

Production has been used for real testing. There are creators, entries,
submissions, approved points and a referral in the database that belong to
nobody, and the leaderboard counts them.

**This has to happen before Monday.** It cannot happen after: the purge refuses
once `starts_at` has passed, because from that moment every row belongs to
somebody who entered in good faith.

1. Sign in at `/admin` as an owner.
2. **Pause the campaign.** Give a reason; creators see it verbatim. Pausing
   first is required, so nobody registers into a database being emptied.
3. In **Clear the test data**, type `monica-money-story` and confirm.
4. Check the counts it reports back.
5. **Start the campaign again.** This is the step that is easy to forget and
   the only one that shows up as an outage.

Then confirm, as an ordinary visitor:

| Check | Where |
|---|---|
| Registration works | `/campaigns/monica-money-story/register` |
| Leaderboard is empty, not broken | `/campaigns/monica-money-story/leaderboard` |
| The review queue is empty | `/admin` |
| You can still sign in | `/admin` |

### What survives

The campaign row, the weekly challenges, the point rules and the award bounds,
every admin and their Netlify Identity binding, and audit rows that are about
admins rather than the campaign.

**Do not drop and re-migrate instead.** It restores all of the above except the
Identity bindings, which are trust-on-first-use and are not in any migration.
Losing them locks every reviewer out, and the first anyone notices is when
submissions need reviewing.

**Do not `TRUNCATE`.** `admin_users` and `campaigns` refuse it outright now, but
the reason is worth knowing: `admin_users` has always refused `DELETE`, and that
guard is a row trigger, which does not fire on `TRUNCATE`.

### If the admin screen is unavailable

From a psql prompt against production:

```sql
SELECT * FROM purge_campaign_data('monica-money-story', 'monica-money-story');
```

The slug is typed twice on purpose. This version has no pause requirement and
no launch deadline: a console prompt against production already has every power
the function could withhold.

Netlify DB does not expose its connection string as a readable site environment
variable. Get it from the database extension in the Netlify project dashboard,
or from the Neon console.

## Still open at the time of writing

| | |
|---|---|
| Monica's gas fee figure | Terms 7.2 says the creator pays, the brief says zero, the same brief says $2 for BTC. The Creator Pack publishes no figure until this is settled. |
| ZeptoMail token | No approval or confirmation email is sent to creators yet (#66). Nothing else is blocked on it. |
| Referral point value | Set to 50. Nothing published states a figure, so it can still change: one `UPDATE` on `point_rules`, no deploy. |
| Monica brand usage rules | Minimum size, clear space, what may sit behind the logo. The pack links the asset folder without them. |

## Numbers worth knowing on the day

| | |
|---|---|
| Pause the campaign | `/admin`, owners only, takes effect on the next click |
| First leaderboard | Saturday 19 September |
| Prize pool | ₦5,000,000 |
