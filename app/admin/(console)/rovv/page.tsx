import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { rovvCodeQueue, rovvCounts, rovvEntries, rovvHeldCodes, type RovvFilter } from "@/lib/admin/rovv";
import { RovvCodePaste, RovvNotify, RovvQueue, RovvResults, RovvRuleOut, RovvTestTools } from "@/components/admin/rovv-queue";
import { PageHeader, Pill, SectionCard, SPACING, Stat } from "@/components/shared/panel";
import { ROVV } from "@/lib/rovv";
import { dateTime, dayDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "ROVV entries",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Rows fetched per view. The list reveals them ten at a time. */
const PAGE_SIZE = 500;

/* "Eligible with a note" is the owner's shortlist when picking winners:
   the entries a judge flagged. Owners only, like the picking. */
const FILTERS: { value: RovvFilter; label: string; owner?: boolean }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Waiting" },
  { value: "eligible", label: "Eligible" },
  { value: "noted", label: "Eligible with a note", owner: true },
  { value: "ineligible", label: "Ineligible" },
  { value: "winners", label: "Winners" },
  { value: "test", label: "Test" },
];

/**
 * Rovv's campaign, on one screen: every entry, the ruling on it, and for
 * owners the winners, the exports and the winner email.
 *
 * Every admin reviews; picking, exporting and emailing are owner work, and
 * each of those routes checks the role again itself. The filter is links,
 * not a form: one tap on a phone, and a filtered view is a URL.
 */
export default async function RovvPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  // The layout has already refused everybody who is not an admin.
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const owner = isOwner(admin.admin);
  const params = await searchParams;
  const asked = params.status;
  // Only values the links offer this admin. Anything else is the default, not a query.
  const filters = FILTERS.filter((f) => owner || !f.owner);
  const filter = filters.find((f) => f.value === asked)?.value ?? "all";
  /* A search, for the entry somebody is writing in about: a name, email,
     username or referral code (and a ticket code, for an owner). */
  const q = params.q?.trim().slice(0, 100) || undefined;
  const withQ = (href: string) => (q ? `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}` : href);

  const [entries, counts, codeQueue, testCodeQueue, heldCodes] = await Promise.all([
    rovvEntries(admin.admin, { status: filter, limit: PAGE_SIZE, q }),
    rovvCounts(admin.admin),
    owner ? rovvCodeQueue(admin.admin, false) : Promise.resolve([] as string[]),
    owner ? rovvCodeQueue(admin.admin, true) : Promise.resolve([] as string[]),
    rovvHeldCodes(admin.admin),
  ]);

  const matching: Record<RovvFilter, number> = {
    all: counts.total,
    pending: counts.pending,
    eligible: counts.eligible,
    ineligible: counts.ineligible,
    winners: counts.winners,
    test: counts.tests,
    noted: counts.noted,
  };
  // Sendable now: picked, with a code, not emailed and not being emailed.
  const untold = Math.max(0, counts.winners - counts.notified - counts.sending - counts.needCode);
  const closed = Date.now() > new Date(ROVV.closesAt).getTime();

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="ROVV"
        title="Entries"
        hint={`Open each video. It must be the entrant's own, public, on the prompt, tagging ${ROVV.rovvHandle} and ${ROVV.blockfestHandle} with ${ROVV.hashtag}. Mark it eligible, or ineligible with the reason. Each ruling emails the entrant: eligible tells them they are in the running, ineligible sends them your reason word for word, so write it to them. If an entrant looks under 18, rule it out with that reason and tell the owner. Owners pick the ${ROVV.winners} winners from eligible entries; ROVV confirms the referral codes from the export.`}
      >
        {/* mobile-grid-ok: four one-word labels over numbers; two columns below
            sm, four above, so no column is ever narrower than about 150px. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat label="Waiting" value={counts.pending} />
          <Stat label="Eligible" value={counts.eligible} />
          <Stat label="Ineligible" value={counts.ineligible} />
          <Stat
            label="Winners"
            value={`${counts.winners} of ${ROVV.winners}`}
            hint={`${counts.notified} emailed`}
          />
        </div>
      </PageHeader>

      {owner && (
        <SectionCard
          id="winners"
          title="Winners"
          aside={
            <Pill tone={untold > 0 ? "warn" : "neutral"}>
              {untold > 0 ? `${untold} not emailed` : `${counts.notified} emailed`}
            </Pill>
          }
        >
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
            {counts.winners} of {ROVV.winners} picked. Winners are promised by {ROVV.winnersByLabel}.
          </p>
          {/* The order the owner works in. A winner email cannot be taken
              back, so ROVV's check of the referral codes comes first. */}
          <ol className="mt-3 flex max-w-prose list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-4">
            <li>
              Send ROVV the referral check file below: daily while entries are open, and once more after the close.
            </li>
            <li>
              Rule out whatever ROVV cannot confirm: paste the emails in the box below (each entrant is emailed the
              reason).
            </li>
            <li>
              Pick the {ROVV.winners} winners from eligible entries, and send ROVV the picked winners file for a last
              check.
            </li>
            <li>Paste the {ROVV.winners} {ROVV.prize} codes: each winner gets their own.</li>
            <li>Email the winners. Each gets their own code, and their username goes on the campaign page.</li>
          </ol>
          <div className="mt-4 border-t border-line pt-4">
            <RovvRuleOut />
          </div>
          {counts.needCode > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <RovvCodePaste waiting={counts.needCode} queue={codeQueue} held={heldCodes} />
            </div>
          )}
          <div className="mt-4">
            <RovvNotify
              untold={untold}
              sending={counts.sending}
              needCode={counts.needCode}
              winners={counts.winners}
              cap={ROVV.winners}
              closed={closed}
            />
          </div>
          {counts.notified > 0 && counts.notified === counts.winners && (
            <div className="mt-4 border-t border-line pt-4">
              <RovvResults
                toSend={counts.resultsToSend}
                sent={counts.resultsSent}
                winners={counts.winners}
                cap={ROVV.winners}
              />
            </div>
          )}

          {/* Links rather than buttons: a GET that changes nothing, and a file
              somebody attaches to an email. The ROVV files are the ones that
              leave: the four fields the privacy notice says ROVV receives,
              for every entry not ruled out, or for the picked winners only,
              so ROVV can confirm each referral code. */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
            <a
              href="/api/admin/rovv/export?of=rovv"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Referral check, for ROVV (CSV)
            </a>
            <a
              href="/api/admin/rovv/export?of=rovv&picked=1"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Picked winners, for ROVV&apos;s final check (CSV)
            </a>
            <a
              href="/api/admin/rovv/export?of=all"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Every entry, for the team only (CSV: has codes and notes)
            </a>
            <a
              href="/api/admin/rovv/export?of=winners"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              The winners, for the team only (CSV: has codes)
            </a>
          </div>
        </SectionCard>
      )}

      {owner && (
        <SectionCard
          id="testing"
          title="Try it yourself"
          aside={counts.tests > 0 ? <Pill tone="neutral">{counts.tests} test {counts.tests === 1 ? "entry" : "entries"}</Pill> : undefined}
        >
          <div className="mt-3">
            <RovvTestTools tests={counts.tests} />
          </div>
          {counts.testNeedCode > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <RovvCodePaste waiting={counts.testNeedCode} queue={testCodeQueue} held={heldCodes} test />
            </div>
          )}
        </SectionCard>
      )}

      <section aria-labelledby="entries-title">
        <h2 id="entries-title" className="sr-only">
          Entries
        </h2>
        <form action="/admin/rovv" method="get" role="search" className="mb-4 flex gap-2">
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          <label htmlFor="rovv-search" className="sr-only">
            Search entries
          </label>
          <input
            id="rovv-search"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            maxLength={100}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={owner ? "Name, email, username, referral or ticket code" : "Name, email, username or referral code"}
            className="min-h-12 w-full min-w-0 flex-1 rounded-lg border border-line bg-control px-4 py-3 text-base text-white placeholder:text-ink-3"
          />
          <button type="submit" className="inline-flex min-h-12 shrink-0 cursor-pointer items-center rounded-full border border-line-2 px-5 text-sm font-semibold text-white hover:bg-card-3">
            Search
          </button>
        </form>
        <nav aria-label="Show" className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={withQ(f.value === "all" ? "/admin/rovv" : `/admin/rovv?status=${f.value}`)}
              aria-current={f.value === filter ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                f.value === filter
                  ? "bg-card-3 text-white"
                  : "text-ink-3 hover:bg-card-2 hover:text-white"
              }`}
            >
              {f.label}
              <span className="tabular-nums text-ink-4">{matching[f.value]}</span>
            </Link>
          ))}
        </nav>

        {entries.length === 0 ? (
          <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-2">
            {q
              ? `Nothing matches “${q}”${filter === "all" ? "" : " under this filter"}.`
              : counts.total === 0
              ? `No entries yet. They appear here as people enter, from ${dayDate(ROVV.opensAt)}.`
              : "Nothing here under that filter."}
          </p>
        ) : (
          <div className="mt-6">
            {q ? (
              <p className="mb-3 text-sm text-ink-3">
                {entries.length} {entries.length === 1 ? "entry matches" : "entries match"} &ldquo;{q}&rdquo;.{" "}
                <Link href={filter === "all" ? "/admin/rovv" : `/admin/rovv?status=${filter}`} className="text-link underline underline-offset-2">
                  Clear the search
                </Link>
              </p>
            ) : (
              entries.length < matching[filter] && (
                <p className="mb-3 text-sm text-ink-3">
                  {filter === "pending"
                    ? `The ${entries.length} that have waited longest, of ${matching[filter]}. Rule on these and the rest move up.`
                    : `The newest ${entries.length} of ${matching[filter]}. Search, or pick a filter above to narrow it.`}
                </p>
              )
            )}
            <RovvQueue
              owner={owner}
              winners={counts.winners}
              cap={ROVV.winners}
              // An eligible ruling after the first winner email is not
              // emailed on purpose, so the card does not flag it.
              announced={counts.notified > 0}
              items={entries.map((e) => ({
                id: e.id,
                fullName: e.fullName,
                email: e.email,
                tiktokHandle: e.tiktokHandle,
                tiktokUrl: e.tiktokUrl,
                referralCode: e.referralCode,
                status: e.status,
                reviewNote: e.reviewNote,
                reviewerEmail: e.reviewerEmail,
                submittedAtLabel: dateTime(e.createdAt),
                reviewedAtLabel: e.reviewedAt ? dateTime(e.reviewedAt) : null,
                winner: e.winnerAt !== null,
                notifiedAtLabel: e.notifiedAt ? dateTime(e.notifiedAt) : null,
                revision: e.revision,
                sameVideo: e.sameVideo,
                isTest: e.isTest,
                sameHandle: e.sameHandle,
                sameReferral: e.sameReferral,
                updatedAtLabel: dateTime(e.updatedAt),
                rulingEmailed: e.rulingEmailed,
                // A code is a free pass, and owner business: a reviewer's
                // page never carries one, even in the data behind it.
                ticketCode: owner ? e.ticketCode : null,
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
