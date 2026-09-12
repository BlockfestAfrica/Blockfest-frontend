# The database, and which one a deploy is talking to

Recorded here because it is dashboard behaviour rather than anything in this
repository, which makes it easy to believe it is set up correctly when nobody
has checked.

## Do deploy previews write to production?

**No.** Netlify DB gives every deploy preview its own branch, seeded with a copy
of production at the moment the preview is created. Schema and data changes on a
preview never reach production. It is wired up by the platform, with no code on
our side arranging it.

Production deploys are the only deploys that touch the production database.

## How to check, rather than believe

`/api/health` reports two things on every deploy:

```json
{ "context": "deploy-preview", "database": "a1b2c3d4e5f6" }
```

`database` is a short hash of the connection host. Never the host, never the
credential. It answers the only question worth asking from outside, which is
whether two deploys are on the same database, and answers it without publishing
an address for somebody to point a client at.

Compare a preview against production. **Different values mean the isolation
holds. The same value means it does not, and registration on a public preview
URL is writing into live campaign data.**

## The risk that is real, and runs the other way

Preview branches are seeded **from production**, so from launch they contain
real creators' names, email addresses, phone numbers, IP addresses and user
agents. **Deploy preview URLs are public and unauthenticated.**

Nothing on the site exposes that data without a credential: the leaderboard
publishes a hand-written whitelist of four fields, the admin screens are behind
Netlify Identity, and a creator's own page needs their access token. But the
data is sitting in a database attached to a publicly reachable deployment, so
the protection is those guards rather than the data's absence.

Two consequences worth holding on to:

- **Do not share a deploy preview link outside the team.** It is a live copy of
  the campaign, including its personal data.
- **A guard that is only bypassed on a preview is still a breach**, because the
  preview has the real rows.

Transactional email is deliberately not available on previews: `ZEPTOMAIL_TOKEN`
is scoped to the production context only, so a preview cannot send to a real
creator's address. `sendEmail` treats the missing token as an expected
condition, logs, and carries on.

## Where things live

| | |
|---|---|
| Migrations | `netlify/database/migrations/`, `<number>_<slug>.sql`, applied in lexicographic order |
| When applied | Immediately before a deploy is published. A failure blocks the publish. |
| Client | `lib/db/client.ts`, over the Neon HTTP driver |
| Connection | `getConnectionString()` from `@netlify/database`. Not an environment variable you can read in the dashboard. |

`DATABASE_URL` wins when set, so a developer can point at their own database.
There is deliberately no `DATABASE_URL` in production: the connection is
injected into the function environment under the platform's own name, and
guessing that name is what made every registration fail in production the first
time.

## Two things never to do

**Never run `drizzle-kit push` or `drizzle-kit migrate` against a hosted
database.** Schema reaches it only as a committed migration applied by a deploy.

**Never trust `netlify db status` or `netlify db connect` for production
state.** Both talk to a local instance. They reported "0 applied, 13 pending"
while production demonstrably had the schema, which cost an afternoon.
