import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { pendingCount, pendingSubmissions } from "@/lib/admin/review";
import { ReviewQueue } from "@/components/admin/review-queue";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

/**
 * The review queue.
 *
 * The header used to print the length of the page it had just fetched, which
 * is the limit, so once fifty-one submissions were waiting it said "50 waiting"
 * and went on saying it however many arrived. The real total now comes from a
 * separate lightweight query, and the page says honestly how many of that total
 * it is showing.
 *
 * There are no lanes. The queue used to split into "Account matches" and
 * "Needs a look" by whether an X or TikTok link carried the registered handle,
 * and the first lane read as checked. It was not a check: that handle is typed
 * by whoever submits the link, and nothing ties it to the post, which
 * post_identity_of keys on the number at the end alone. A creator registered
 * as @thief could file x.com/thief/status/<somebody else's post> and land in
 * the matching lane. Nothing the server holds can say who published a post.
 * Every row is the same job, opening it and looking at the author the platform
 * shows, so the page no longer sorts rows by a check that does not exist.
 */
export default async function AdminQueuePage() {
  // The layout has already refused everybody who is not an admin, so this is
  // the cached second call rather than a second round trip.
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const total = await pendingCount(admin.admin);
  const queue = await pendingSubmissions(admin.admin, PAGE_SIZE);

  return (
    <>
      <p className="eyebrow text-brand-gold">Review</p>
      <h1
        className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white"
        aria-live="polite"
      >
        {total} waiting
      </h1>

      {queue.length < total && (
        <p className="mt-3 text-sm text-ink-3">
          Oldest first. This page holds {queue.length} of {total}. Decide
          these and the next {PAGE_SIZE} appear.
        </p>
      )}
      {total > 0 && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          Approving mints points against the prize pool and is recorded against
          your name. Open every link and check the author the platform shows
          against the handle on the row. Nothing here checks it for you: the
          name inside an X or TikTok link is typed by whoever submits it.
        </p>
      )}

      {queue.length === 0 ? (
        <p className="mt-8 max-w-prose text-base leading-relaxed text-ink-3">
          Nothing waiting. Submissions appear here as creators send them in.
        </p>
      ) : (
        <ReviewQueue
          items={queue.map((item) => ({
            id: item.id,
            url: item.url,
            weekNo: item.weekNo,
            challengeTitle: item.challengeTitle,
            platformLabel:
              platformLabels[item.platform as CampaignPlatform] ??
              item.platform,
            submittedAt: item.submittedAt.toISOString(),
            creatorName: item.creatorName,
            registeredHandle: item.registeredHandle,
            contested: Boolean(item.contested),
            creditedElsewhere: Boolean(item.creditedElsewhere),
          }))}
        />
      )}
    </>
  );
}
