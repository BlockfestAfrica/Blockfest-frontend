import type { Metadata } from "next";
import Link from "next/link";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { rovvCounts, rovvEntries, type RovvFilter } from "@/lib/admin/rovv";
import { RovvQueue } from "@/components/admin/rovv-queue";
import { PageHeader, SPACING, Stat } from "@/components/shared/panel";
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
 * Rovv's entries: every one, and the ruling on it. The winners, the exports
 * and the winner email were above the list here; they have their own screen
 * now (ROVV → Winners), as do the test tools (ROVV → Try it yourself).
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

  const [entries, counts] = await Promise.all([
    rovvEntries(admin.admin, { status: filter, limit: PAGE_SIZE, q }),
    rovvCounts(admin.admin),
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
