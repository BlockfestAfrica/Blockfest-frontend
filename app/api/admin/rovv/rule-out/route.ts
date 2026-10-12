import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import {
  decideRovvEntry,
  rovvEntriesByEmail,
  rovvRulingEmail,
  sendRovvRulingEmail,
  type RovvEntryByEmail,
} from "@/lib/admin/rovv";
import { canonicalEmail } from "@/lib/campaign-registration";
import { PG, pgErrorCode } from "@/lib/db/errors";
import type { Email } from "@/lib/email/client";
import { sendBulkCopy } from "@/lib/email/copy";
import { ROVV_SLUG } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* A ruling and an email per entry, a few at a time; the announce routes' budget. */
export const maxDuration = 300;

/**
 * Rule out, in one go, every entry whose referral code ROVV could not
 * confirm: ROVV answers with a list of email addresses, and the owner pastes
 * it here rather than finding and ruling each entry by hand on the Monday
 * the winners are due.
 *
 * Owners only. Real entries only, matched by canonical address (the form's
 * own rule, so Ada+rovv@ and ada@ are one person). Each match not already
 * out is ruled exactly as a reviewer's press would rule it: through
 * decide_rovv_entry, on the revision and ruling it holds now, with the
 * reason, and then emailed exactly as the decision route emails it
 * (rovvRulingEmail), so the fix-it-before-Sunday wording, the closed wording
 * and the never-the-same-news-twice rule all hold.
 *
 * A picked winner in the list is not ruled out: the database keeps a winner
 * eligible, and quietly unpicking one here would free a ticket nobody chose
 * to free. They come back by name for the owner to unpick first. Addresses
 * that match nobody come back too, as typed, to check for a typo.
 *
 * A bulk send, so the owner's copy goes first (lib/email/copy.ts). Not
 * throttled: an email goes only with a ruling that changed an entry, and
 * ruling_emailed stops a repeat, so pressing again emails nobody twice.
 * Entries are ruled and emailed a batch at a time, and no batch starts after
 * BUDGET_MS, so everyone ruled out by a press has had their email tried by
 * it; `left` says how many the next press has to do.
 */

const DEFAULT_REASON = "ROVV could not confirm your referral code.";

const schema = z.object({
  /** The pasted text: one address per line, or separated by commas, semicolons or spaces. */
  emails: z
    .string()
    .max(20_000, "That is longer than any list ROVV would send. Paste only the email addresses."),
  /** Emailed to each entrant word for word, as a reviewer's reason is. */
  reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
});

/** Rulings and sends started together, as the other bulk routes do. */
const BATCH = 4;
/*
 * How long a press keeps starting batches, as the results press does:
 * Netlify ends a function at the plan's own limit, which may be far under
 * maxDuration, and a press killed mid-way answers with the platform's error
 * page after some entrants have been ruled out and emailed.
 */
const BUDGET_MS = 35_000;
const CONTEXT = "admin/rovv rule-out";

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

/**
 * The addresses in pasted text, once each by canonical form, as typed (in
 * lower case). Anything that is not an address is skipped, so a pasted
 * spreadsheet row (name, address, username, code) reads as its address.
 * The console's preview count reads the text the same way
 * (components/admin/rovv-queue.tsx).
 */
function readEmails(text: string): { typed: string; canonical: string }[] {
  const seen = new Set<string>();
  const found: { typed: string; canonical: string }[] = [];
  for (const piece of text.split(/[\s,;]+/)) {
    // <ada@example.test>, "ada@example.test", mailto:ada@example.test, ada@example.test.
    const typed = piece
      .replace(/^[<("'[]+|[>)"'\].:]+$/g, "")
      .replace(/^mailto:/i, "")
      .toLowerCase();
    if (!/^[^\s@<>()"':]+@[^\s@<>()"':]+\.[a-z]{2,}$/.test(typed)) continue;
    const canonical = canonicalEmail(typed);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    found.push({ typed, canonical });
  }
  return found;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  // From the request's start: the platform's clock does not wait for ours.
  const stopAt = Date.now() + BUDGET_MS;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  // A list of several hundred addresses is far past a review decision's 4KB.
  const read = await readJsonBody(request, 32 * 1024);
  if (!read.ok) return fail("We could not read that.");
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the list.");

  const reason = parsed.data.reason || DEFAULT_REASON;
  const pasted = readEmails(parsed.data.emails);
  if (pasted.length === 0) return fail("Paste the email addresses ROVV could not confirm first.");

  try {
    const found = await rovvEntriesByEmail(admin.admin, pasted.map((p) => p.canonical));
    const matched = new Set(found.map((e) => e.emailCanonical));
    const unmatched = pasted.filter((p) => !matched.has(p.canonical)).map((p) => p.typed);
    const winners = found.filter((e) => e.winner);
    const out = found.filter((e) => !e.winner && e.status === "ineligible");
    const alreadyOut = out.length;
    /* Already out but never told (their email failed last time): pasting
       them again sends it now, which is how the box retries a failure. */
    const retry = out.filter((e) => e.rulingEmailed !== "ineligible");
    const toRule = found.filter((e) => !e.winner && e.status !== "ineligible");

    /* Each ruled on its own, so one refused (picked or replaced since the
       list was read) does not stop the rest; each email built the moment its
       ruling lands, and sent with its batch. */
    const notRuled: RovvEntryByEmail[] = [];
    const unsent: RovvEntryByEmail[] = [];
    let ruledOut = 0;
    let emailed = 0;
    let emailFailed = 0;
    let done = 0;
    let copied = false;

    for (const entry of retry) {
      if (Date.now() >= stopAt) break;
      const email = await rovvRulingEmail(admin.admin, entry.id, "ineligible", reason, CONTEXT);
      if (!email) continue;
      if (await sendRovvRulingEmail(admin.admin, entry.id, "ineligible", email, CONTEXT)) emailed += 1;
      else {
        emailFailed += 1;
        unsent.push(entry);
      }
    }
    for (let i = 0; i < toRule.length; i += BATCH) {
      // Out of time: the rest are untouched, so the next press rules them.
      if (Date.now() >= stopAt) break;
      const batch = toRule.slice(i, i + BATCH);
      done += batch.length;
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          await decideRovvEntry(admin.admin, entry.id, "ineligible", reason, entry.revision, entry.status);
          return rovvRulingEmail(admin.admin, entry.id, "ineligible", reason, CONTEXT);
        }),
      );

      const mails: { entry: RovvEntryByEmail; email: Email }[] = [];
      results.forEach((result, j) => {
        const entry = batch[j];
        if (result.status === "fulfilled") {
          ruledOut += 1;
          if (result.value) mails.push({ entry, email: result.value });
          return;
        }
        const code = pgErrorCode(result.reason);
        if (code === PG.ROVV_WINNER_STAYS_ELIGIBLE) winners.push(entry);
        else {
          notRuled.push(entry);
          // Only the code: a query error carries its parameters.
          if (code !== PG.ROVV_ENTRY_CHANGED && code !== PG.ROVV_RULED_MEANWHILE) {
            logError(CONTEXT, new Error(`entry not ruled out: ${code ?? "no SQLSTATE"}`));
          }
        }
      });

      if (!copied && mails.length > 0) {
        // The owner's copy, before anyone's: as many as this list rules out.
        await sendBulkCopy(mails[0].email, toRule.length, "rovv rule-out");
        copied = true;
      }
      const sent = await Promise.allSettled(
        mails.map((m) => sendRovvRulingEmail(admin.admin, m.entry.id, "ineligible", m.email, CONTEXT)),
      );
      sent.forEach((one, k) => {
        if (one.status === "fulfilled" && one.value) emailed += 1;
        else {
          emailFailed += 1;
          unsent.push(mails[k].entry);
        }
      });
    }
    const left = toRule.length - done;

    // Counts only: the trail is for the team, not a copy of ROVV's list.
    // Each ruling has its own row already, from decide_rovv_entry.
    await getDb()
      .execute(
        sql`INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, after)
            VALUES ((SELECT id FROM campaigns WHERE slug = ${ROVV_SLUG}),
                    ${admin.admin.adminId}::uuid, 'rovv.ruled_out', 'campaign',
                    ${JSON.stringify({
                      pasted: pasted.length,
                      ruledOut,
                      alreadyOut,
                      winners: winners.length,
                      unmatched: unmatched.length,
                      emailed,
                      emailFailed,
                      left,
                    })}::jsonb)`,
      )
      .catch((error) => logError(`${CONTEXT} audit`, error));

    return NextResponse.json({
      ok: true,
      ruledOut,
      alreadyOut,
      // With the address, so the console can put them back in the box to
      // paste again once they have been unpicked.
      winners: winners.map((e) => ({ handle: e.tiktokHandle, email: e.email })),
      unmatched,
      // With addresses, so the console keeps them in the box: pasting them
      // again rules the changed ones and resends the failed emails.
      notRuled: notRuled.map((e) => ({ handle: e.tiktokHandle, email: e.email })),
      unsent: unsent.map((e) => ({ handle: e.tiktokHandle, email: e.email })),
      emailed,
      emailFailed,
      left,
    });
  } catch (error) {
    logError(CONTEXT, new Error(`nothing ruled out: ${pgErrorCode(error) ?? "no SQLSTATE"}`));
    return fail("Something went wrong at our end.", 500);
  }
}
