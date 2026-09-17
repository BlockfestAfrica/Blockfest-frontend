# Security review, as this repository actually does it

Issue #79 asked for a standing rule: security review each PR before merge.
This records the practice that grew out of running it, so it survives the
people who happened to be here.

## The standing rule

Every PR that touches an input, a session, money, or a migration gets an
adversarial pass before merge. Not a checklist read, an attempt to break it:
the reviewer's job is a concrete walk that defeats the change, and a failed
attempt is the approval.

## What that means in practice here

1. **Guards are proved, not written.** A test that protects something is
   committed together with the injected defect run that shows it failing by
   name. A guard nobody has watched fail is prose.
2. **The database enforces; routes translate.** Any rule that matters is a
   constraint or a plpgsql check with its own SQLSTATE. If a rule exists only
   in a route, the review asks why.
3. **Redefinitions cannot silently drop rules.** `function-lineage.test.ts`
   fails the build if a `CREATE OR REPLACE` loses a `RAISE` its predecessor
   had, unless the drop is recorded in `DELIBERATELY_DROPPED` with reasoning.
   This has caught one real revert and recorded one real decision.
4. **Nothing personal reaches a log.** `lib/log.ts` is the only path for
   error text; new `console.*` calls carrying interpolated values are review
   findings. The one route that holds a password logs error names only.
5. **No external script executes on this origin.** The CSP guard in
   `token-url-exposure.test.ts` fails the build if any policy grants
   `script-src` to an external host. Third-party code is pinned and served
   from `public/`.
6. **Migrations are immutable once applied and never share a prefix.** Both
   are tested. Corrections are new migrations that regenerate from the LATEST
   definition, never from the one that introduced the function.
7. **When the change is large, the review is adversarial and parallel:**
   independent agents attack through separate lenses (bypass, broken
   legitimate user, environment and concurrency), and a finding survives only
   if a refuter fails to kill it. The findings land as issues with evidence,
   and issues close only with verification against main.

## The scope trigger

A PR needs the full pass when it touches: `app/api/`, `lib/creator-*`,
`lib/admin/`, `netlify/database/migrations/`, `next.config.ts`, auth or
cookies anywhere, or anything that writes to `point_ledger`.

## The original per-PR checklist, from #79, kept verbatim

- **Secrets**: no keys, tokens or connection strings in the diff, in client
  bundles, or in `NEXT_PUBLIC_*`.
- **PII**: no real personal data committed as fixtures or test data. Ever.
- **Authorisation**: every new admin route and server action calls the guard.
  A hidden tab is a tidy interface, not a permission.
- **Input**: zod on every request body and query param. Submitted URLs
  validated https-only against the platform host allowlist before storing or
  rendering, and rendered `rel="noopener noreferrer nofollow"`.
- **Rate limiting**: DB-backed. In-memory maps are per-instance and provide
  close to no protection on serverless.
- **Points**: every mutation writes a ledger row with an actor. No mutable
  counters.
- **Leaderboard payloads**: serialise explicitly. Never spread a creator row
  into a public response, or emails and phone numbers leak.
- **Static pages**: confirm the marketing pages are still prerendered and no
  new `connect-src` entry crept into the CSP.
