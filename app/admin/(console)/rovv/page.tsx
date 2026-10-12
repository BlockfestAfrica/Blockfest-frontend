import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { rovvCounts, rovvEntries, type RovvFilter } from "@/lib/admin/rovv";
import { RovvNotify, RovvQueue } from "@/components/admin/rovv-queue";
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

const FILTERS: { value: RovvFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Waiting" },
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
  { value: "winners", label: "Winners" },
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
  searchParams: Promise<{ status?: string }>;
}) {
  // The layout has already refused everybody who is not an admin.
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const owner = isOwner(admin.admin);
  const asked = (await searchParams).status;
  // Only values the links offer. Anything else is the default, not a query.
  const filter = FILTERS.find((f) => f.value === asked)?.value ?? "all";

  const [entries, counts] = await Promise.all([
    rovvEntries(admin.admin, { status: filter, limit: PAGE_SIZE }),
    rovvCounts(admin.admin),
  ]);

  const matching: Record<RovvFilter, number> = {
    all: counts.total,
    pending: counts.pending,
    eligible: counts.eligible,
    ineligible: counts.ineligible,
    winners: counts.winners,
  };
  const untold = counts.winners - counts.notified - counts.sending;
  const closed = Date.now() > new Date(ROVV.closesAt).getTime();

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="ROVV"
        title="Entries"
        hint={`Open each video. It must be the entrant's own, public, on the prompt, tagging ${ROVV.rovvHandle} and ${ROVV.blockfestHandle} with ${ROVV.hashtag}. Mark it eligible, or ineligible with the reason. Owners pick the ${ROVV.winners} winners from eligible entries; ROVV confirms the referral codes from the export.`}
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
            {counts.winners} of {ROVV.winners} picked. Winners are promised an
            email by {dayDate(`${ROVV.winnersBy}T12:00:00+01:00`)}, and a winner
            shows on the campaign page once theirs has gone.
          </p>
          <div className="mt-4">
            <RovvNotify
              untold={untold}
              sending={counts.sending}
              winners={counts.winners}
              cap={ROVV.winners}
              closed={closed}
            />
          </div>

          {/* Links rather than buttons: a GET that changes nothing, and a file
              somebody attaches to an email. The ROVV file is the one that
              leaves: the four fields the privacy notice says ROVV receives,
              for every entry, so ROVV can confirm each referral code. */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
            <a
              href="/api/admin/rovv/export?of=rovv"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Referral check, for ROVV (CSV)
            </a>
            <a
              href="/api/admin/rovv/export?of=all"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Every entry, for the team (CSV)
            </a>
            <a
              href="/api/admin/rovv/export?of=winners"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              The winners (CSV)
            </a>
          </div>
        </SectionCard>
      )}

      <section aria-labelledby="entries-title">
        <h2 id="entries-title" className="sr-only">
          Entries
        </h2>
        <nav aria-label="Show" className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/admin/rovv" : `/admin/rovv?status=${f.value}`}
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
            {counts.total === 0
              ? `No entries yet. They appear here as people enter, from ${dayDate(ROVV.opensAt)}.`
              : "Nothing here under that filter."}
          </p>
        ) : (
          <div className="mt-6">
            {entries.length < matching[filter] && (
              <p className="mb-3 text-sm text-ink-3">
                The newest {entries.length} of {matching[filter]}. Pick a filter
                above to narrow it.
              </p>
            )}
            <RovvQueue
              owner={owner}
              winners={counts.winners}
              cap={ROVV.winners}
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
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
