import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { announcedWinners, snapshotsTaken } from "@/lib/admin/winners";
import { WinnerTags } from "@/components/admin/winner-tags";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SectionCard, SPACING } from "@/components/shared/panel";
import { count, dateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Who is owed what, and the working behind it.
 *
 * These were the bottom half of Winners, under the week's jobs. They are about
 * every week rather than this one, and they are what somebody opens two days
 * before a transfer, so they have their own screen: the winners of both
 * awards with the Monica tag each prize is paid to, the exports, and the
 * standings recorded each Saturday.
 */
export default async function PayoutsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Results"
        why="Payouts name who is paid and where, so they are restricted to owners."
      />
    );
  }

  const [announced, snapshots] = await Promise.all([announcedWinners(admin.admin), snapshotsTaken(admin.admin)]);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Results"
        title="Payouts"
        hint="Every announced winner and the Monica tag their prize goes to, the working for the people being paid, and each week's recorded standings."
      />

      {/* Who has won, of both awards, and the Monica tag each prize is paid
          to, for copying. */}
      <WinnerTags
        winners={announced.map((w) => ({
          weekNo: w.weekNo,
          category: w.category,
          name: w.name,
          monicaTag: w.monicaTag,
          email: w.email,
          prizeNaira: w.prizeNaira,
        }))}
      />

      {/*
       * The working, for the people being paid.
       *
       * Links rather than buttons: a GET that changes nothing, and a link can be
       * opened, saved and attached to an email, which is what somebody actually
       * does with it two days before a transfer.
       */}
      <SectionCard id="paperwork" title="Paperwork">
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
          Every ledger row for the top five, with who awarded it and why: the
          document a dispute is answered with. No bank details; the platform
          never holds any.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/admin/payout"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Points, with the working
          </a>
          <a
            href="/api/admin/payout?of=entries"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            The entries they were paid for
          </a>
        </div>

        {snapshots.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-4">
              Recorded so far
            </h3>
            {/* A definition list, because every row is week then facts about
                that week. Each row opens the frozen table it names: the freeze
                is the payout record, and a record nobody can open is a rumour. */}
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {snapshots.map((s) => (
                <div key={`${s.weekNo}-${s.version}`}>
                  <Link
                    href={`/admin/winners/snapshots?week=${s.weekNo}&version=${s.version}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 transition-colors hover:bg-card-2"
                  >
                    <dt className="font-semibold text-link underline underline-offset-4">
                      Week {s.weekNo}
                    </dt>
                    <dd className="text-sm text-ink-3">
                      {count(s.rows)} creators
                      {s.version > 1 && ` · version ${s.version}`}
                      <span className="ml-2 text-ink-4">
                        {dateTime(s.takenAt)}
                      </span>
                    </dd>
                  </Link>
                </div>
              ))}
            </dl>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
