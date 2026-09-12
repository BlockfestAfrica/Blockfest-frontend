import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { decidedSubmissions } from "@/lib/admin/review";
import { Pill } from "@/components/shared/panel";
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
      <p className="eyebrow text-brand-gold">Decided</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        Last {decided.length}
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
        Newest first. {mine.length} of these {mine.length === 1 ? "was" : "were"}{" "}
        decided by you. This is the only place a mis-tap can be found again.
      </p>

      {decided.length === 0 ? (
        <p className="mt-8 max-w-prose text-base leading-relaxed text-white/60">
          Nothing decided yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12">
          {decided.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Pill tone={item.status === "approved" ? "good" : "bad"}>
                  {item.status === "approved" ? "Approved" : "Rejected"}
                </Pill>
                <span className="text-base font-semibold text-white">
                  {item.creatorName}
                </span>
                <span className="text-sm text-white/60">
                  W{item.weekNo} ·{" "}
                  {platformLabels[item.platform as CampaignPlatform] ??
                    item.platform}
                </span>
              </div>
              <p className="mt-1 text-sm text-white/55">
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
                <p className="mt-2 border-l-2 border-white/20 pl-3 text-sm leading-relaxed text-white/75">
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
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-white/70 hover:text-white">
          Can a decision be changed?
        </summary>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
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
