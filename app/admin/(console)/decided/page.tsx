import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { decidedSubmissions } from "@/lib/admin/review";
import { PageHeader, Pill } from "@/components/shared/panel";
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
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {decided.map((item) => (
            <li
              key={item.id}
              /* The status spine: the same 2px edge the queue, the job cards
                 and the rail speak. Scanned down the column it answers the
                 screen's one question, which of these was a mis-tap, without
                 reading a single pill. */
              className={`border-l-2 p-4 ${
                item.status === "approved"
                  ? "border-l-green-400/70"
                  : "border-l-red-400/70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Pill tone={item.status === "approved" ? "good" : "bad"}>
                  {item.status === "approved" ? "Approved" : "Rejected"}
                </Pill>
                <span className="text-base font-semibold text-white">
                  {item.creatorName}
                </span>
                <span className="text-sm text-ink-3">
                  W{item.weekNo} ·{" "}
                  {platformLabels[item.platform as CampaignPlatform] ??
                    item.platform}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-3">
                {item.reviewerEmail ?? "reviewer no longer listed"}
                {item.reviewedAt
                  ? ` · ${item.reviewedAt.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Africa/Lagos",
                    })}`
                  : ""}
              </p>
              {item.reviewNote && (
                <p className="mt-2 border-l-2 border-line-2 pl-3 text-sm leading-relaxed text-ink-2">
                  {item.reviewNote}
                </p>
              )}
            </li>
          ))}
        </ul>
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
