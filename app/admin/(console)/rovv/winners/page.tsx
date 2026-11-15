import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { rovvCodeQueue, rovvCounts, rovvHeldCodes } from "@/lib/admin/rovv";
import { RovvCodePaste, RovvNotify, RovvResults, RovvRuleOut } from "@/components/admin/rovv-queue";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, Pill, SectionCard, SPACING } from "@/components/shared/panel";
import { ROVV } from "@/lib/rovv";

export const metadata: Metadata = {
  title: "ROVV winners",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ROVV's winners, in the order the owner works: the referral check, ruling
 * out what ROVV cannot confirm, the codes, the winner emails, then the
 * results email to everybody else.
 *
 * Was the top of the ROVV page, above the entries. Picking happens on the
 * entries themselves, so step three links there. Owners only, and every
 * route behind it checks the role again.
 */
export default async function RovvWinnersPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="ROVV"
        why="Picking, exporting and emailing winners hands out ticket codes, so they are restricted to owners."
      />
    );
  }

  const [counts, codeQueue, heldCodes] = await Promise.all([
    rovvCounts(admin.admin),
    rovvCodeQueue(admin.admin, false),
    rovvHeldCodes(admin.admin),
  ]);

  // Sendable now: picked, with a code, not emailed and not being emailed.
  const untold = Math.max(0, counts.winners - counts.notified - counts.sending - counts.needCode);
  const closed = Date.now() > new Date(ROVV.closesAt).getTime();

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="ROVV"
        title="Winners"
        hint={`${counts.winners} of ${ROVV.winners} picked. Winners are promised by ${ROVV.winnersByLabel}.`}
      />

      <SectionCard
        id="winners"
        title="The steps, in order"
        aside={
          <Pill tone={untold > 0 ? "warn" : "neutral"}>
            {untold > 0 ? `${untold} not emailed` : `${counts.notified} emailed`}
          </Pill>
        }
      >
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
            Pick the {ROVV.winners} winners from{" "}
            <Link href="/admin/rovv?status=eligible" className="text-link underline underline-offset-2 hover:text-white">
              eligible entries
            </Link>
            , and send ROVV the picked winners file for a last check.
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
    </div>
  );
}
