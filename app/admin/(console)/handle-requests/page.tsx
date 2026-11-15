import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { pendingHandleRequests } from "@/lib/admin/handle-requests";
import { HandleRequestQueue } from "@/components/admin/handle-request-queue";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Handle corrections",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Creators asking to correct a handle they registered with.
 *
 * Was a card at the top of People that only appeared while something was
 * waiting, so there was nowhere to go to check. It has its own line in the
 * menu now and says so when the queue is empty. Owners decide these.
 */
export default async function HandleRequestsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Creators"
        why="Approving a correction changes which account a creator's entries are checked against, so it is restricted to owners."
      />
    );
  }

  const requests = await pendingHandleRequests(admin.admin);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Creators"
        title="Handle corrections"
        hint="A creator who registered the wrong handle asks for the right one from their page. Their entries are checked against the old handle until you decide."
      />
      {requests.length === 0 ? (
        <p className="max-w-prose text-base leading-relaxed text-ink-2">Nothing waiting. New requests appear here.</p>
      ) : (
        <HandleRequestQueue
          requests={requests.map((r) => ({
            id: r.id,
            creatorName: r.creatorName,
            creatorEmail: r.creatorEmail,
            platform: r.platform,
            oldHandle: r.oldHandle,
            requestedHandle: r.requestedHandle,
            takenBy: r.takenBy,
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
