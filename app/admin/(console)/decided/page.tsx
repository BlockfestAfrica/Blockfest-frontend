import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { decidedSubmissions } from "@/lib/admin/review";
import { PageHeader } from "@/components/shared/panel";
import { DecidedList } from "@/components/admin/decided-list";
import { dateTime } from "@/lib/format";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Decided",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * What has already been decided.
 *
 * The queue only ever showed what was waiting, so a decision left no trace
 * anywhere a reviewer could reach. That matters because approving is effectively
 * irreversible: it mints points and emails the creator, and while the opposite
 * decision can still be sent, nothing puts a submission back to waiting.
 *
 * This costs one query. The schema has carried who decided, when, and what they
 * wrote since the first migration, so the only reason this did not exist is
 * that nobody had asked the question yet.
 */
export default async function DecidedPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const decided = await decidedSubmissions(admin.admin);
  const mine = decided.filter((d) => d.reviewerEmail === admin.admin.email);

  return (
    <>
      {/* The place, not a count: "Last 47" changed with every decision and
          told a returning reviewer nothing about where they were. Same rule
          the People screen already follows. */}
      <PageHeader
        context="Review"
        title="Decided"
        hint={`Newest first, the last ${decided.length} decisions, ${mine.length} by you. This is the only place a mis-tap can be found again.`}
      />

      {decided.length === 0 ? (
        <p className="mt-8 max-w-prose text-base leading-relaxed text-ink-3">
          Nothing decided yet.
        </p>
      ) : (
        <DecidedList
          items={decided.map((item) => ({
            id: item.id,
            status: item.status,
            creatorName: item.creatorName,
            weekNo: item.weekNo,
            platformLabel:
              platformLabels[item.platform as CampaignPlatform] ??
              item.platform,
            reviewerEmail: item.reviewerEmail,
            reviewedAtLabel: item.reviewedAt ? dateTime(item.reviewedAt) : null,
            reviewNote: item.reviewNote,
          }))}
        />
      )}

      {/* Honest about what "changing a decision" actually does. There is no
          undo: the creator has already been told, and nothing returns a
          submission to waiting. */}
      <details className="mt-10">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2 hover:text-white">
          Can a decision be changed?
        </summary>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
          Only by sending the opposite decision, which is not an undo. A creator
          who was approved has already been emailed that they were approved and
          will then be emailed that they were rejected, and their points move
          accordingly. Nothing puts a submission back to waiting. If a decision
          was wrong, the honest fix is usually a manual points adjustment on the
          People tab with the reason written down.
        </p>
      </details>
    </>
  );
}
