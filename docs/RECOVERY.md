# Recovery

For the day something has gone wrong with the campaign database. Written to be
read at two in the morning by somebody who did not build it.

**The thing that cannot be reconstructed is `point_ledger`.** It is the only
record of who earned what, and it cannot be rebuilt from social media: an
approved entry leaves a post, but the points it scored, every bonus, every
correction and every referral payout exist nowhere else. Losing a week of it
does not make the campaign untidy, it makes it unsettleable.

## First, do not fix anything

Work out what state you are in before changing it. Every step below is a read.

```bash
# Which database is this deploy on, and is it production?
curl -s https://blockfestafrica.com/api/health | jq '{context, database}'
```

`database` is a hash of the connection host, so you can compare deploys without
handling a credential. See [DATABASE.md](DATABASE.md).

## Is the data still correct?

```bash
npm run verify:db "postgres://..."
```

Eleven invariants, run against any connection string, read-only. The important
one is the sixth: every creator's `points_total` must equal the sum of their
ledger rows. `points_total` is a cache; the ledger is the record. Where they
disagree, somebody is being paid the wrong amount.

Get the connection string from the database extension in the Netlify project, or
from the Neon console. Never from a file in this repository, because there is
not one.

A failure prints what it expected, what it found, and why that matters.

## If you need to restore

Netlify DB exposes snapshots and branch restore through its API. **Restore to a
branch, never over production.** A restore that overwrites production while you
are still working out what went wrong turns one problem into two.

1. Take a snapshot of production **first**, whatever state it is in. The current
   state may be wrong, and it is still evidence.
2. Restore the candidate snapshot to a **new branch**.
3. Run `npm run verify:db` against that branch. This is the step people skip.
4. Compare row counts against what you expect: creators, submissions, approved
   entries, ledger rows.
5. Only then decide whether to cut over.

Branch delete and snapshot restore are destructive. Neither should be done by
anybody who has not been asked to do it by the person who owns the campaign.

## Rehearse it before you need it

**A backup nobody has restored is a belief, not a backup.** The drill is:

1. Restore the most recent snapshot to a scratch branch.
2. `npm run verify:db "<that branch>"` and confirm every check passes.
3. Delete the scratch branch.

Do it once before the campaign opens, and once more after the first approvals
exist, because those are the rows whose loss is unrecoverable.

**Confirm what retention actually is on the current plan.** Do not assume a
default: it is the number that decides how far back you can go, and it is worth
knowing before the day you need it rather than during.

## What migrations do on their own

Netlify applies everything in `netlify/database/migrations/` before a deploy is
published, in lexicographic order, and keeps its own ledger. Running the same
migration twice is a no-op, and editing one that has already been applied is
rejected as checksum drift rather than silently re-run.

So there is nothing to apply by hand, and **nothing should be applied by hand**.
Schema reaches a hosted database only as a committed migration applied by a
deploy.

Two things that will waste your time if you trust them:

- **`netlify db status` and `netlify db connect` report on a local instance**,
  not production. They once said "0 applied, 13 pending" while production
  demonstrably had the schema.
- **Never run `drizzle-kit push` or `drizzle-kit migrate`** against a hosted
  database.

## If the campaign is live and something is wrong

Stop the bleeding before investigating. `/admin` → Campaign → **Pause**, with a
reason, which creators see. It takes effect on their next click rather than on
the next deploy, and nothing already submitted is affected.

Then investigate. Then start it again, which is the step people forget.
