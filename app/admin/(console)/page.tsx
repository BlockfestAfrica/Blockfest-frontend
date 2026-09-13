import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { pendingAttribution, pendingSubmissions } from "@/lib/admin/review";
import { ReviewQueue } from "@/components/admin/review-queue";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { authorFromUrl } from "@/lib/campaign-submission";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

type Lane = "all" | "checked" | "look";

/**
 * The review queue.
 *
 * The header used to print the length of the page it had just fetched, which
 * is the limit, so once fifty-one submissions were waiting it said "50 waiting"
 * and went on saying it however many arrived. The real total now comes from a
 * separate lightweight query, and the page says honestly how many of that total
 * it is showing.
 *
 * The lanes split the queue by whether the link names its author. That is
 * cheaper to review, not free: the check only proves the link belongs to the
 * registered account and says nothing about whether the post answers the week's
 * brief. Approving mints points, so every row still has to be opened, and
 * nothing on this page is worded to suggest otherwise.
 */
export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  // The layout has already refused everybody who is not an admin, so this is
  // the cached second call rather than a second round trip.
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const params = await searchParams;
  const lane: Lane =
    params.lane === "checked" || params.lane === "look" ? params.lane : "all";

  /*
   * Lanes are computed here rather than in SQL.
   *
   * authorFromUrl special-cases reserved x.com segments, TikTok @-segments and
   * vm./vt. share links, and returns null for every Instagram URL. A LIKE
   * clause approximating that would drift from the function that actually makes
   * the decision, and produce counts that are wrong in a way that looks right.
   */
  const attribution = await pendingAttribution(admin.admin);
  const withLane = attribution.map((row) => ({
    id: row.id,
    autoChecked:
      authorFromUrl(row.url, row.platform as CampaignPlatform) !== null,
  }));

  const total = withLane.length;
  const checkedCount = withLane.filter((r) => r.autoChecked).length;
  const lookCount = total - checkedCount;

  const laneIds =
    lane === "all"
      ? undefined
      : withLane
          .filter((r) => (lane === "checked" ? r.autoChecked : !r.autoChecked))
          .map((r) => r.id)
          .slice(0, PAGE_SIZE);

  const queue = await pendingSubmissions(
    admin.admin,
    PAGE_SIZE,
    laneIds ? laneIds : undefined,
  );

  const shownOf =
    lane === "all" ? total : lane === "checked" ? checkedCount : lookCount;

  return (
    <>
      <p className="eyebrow text-brand-gold">Review</p>
      <h1
        className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white"
        aria-live="polite"
      >
        {total} waiting
      </h1>

      {queue.length < shownOf && (
        <p className="mt-3 text-sm text-white/60">
          Oldest first. Showing {queue.length} of {shownOf}. Decide these and
          the next {PAGE_SIZE} appear.
        </p>
      )}
      {total > 0 && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
          Approving mints points against the prize pool and is recorded against
          your name. Open every link: the check only says whether the link names
          the right account, not whether the post answers the brief.
        </p>
      )}

      {/* Rounded pills filter. Flat items with a bottom edge navigate.
          Not rendered on an empty queue: three chips reading zero are three
          controls for nothing, and on a phone they are a row of chrome above
          a sentence saying there is nothing here. */}
      {total > 0 && (
        <div
          className="mt-6 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter the queue"
        >
          <LaneChip lane="all" active={lane} label="All" count={total} />
          <LaneChip
            lane="look"
            active={lane}
            label="Needs a look"
            count={lookCount}
          />
          <LaneChip
            lane="checked"
            active={lane}
            label="Account matches"
            count={checkedCount}
          />
        </div>
      )}

      {queue.length === 0 ? (
        <p className="mt-8 max-w-prose text-base leading-relaxed text-white/60">
          {total === 0
            ? "Nothing waiting. Submissions appear here as creators send them in."
            : "Nothing in this lane. Try another filter."}
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
            handleVerified: item.handleVerifiedAt !== null,
            handleId: item.handleId,
            verificationCode: item.verificationCode,
            /*
             * Whether the server could check the link against the handle.
             *
             * X always carries the author in the path, TikTok only in its full
             * web form and not in a vm. or vt. share link, and Instagram never.
             * So the automatic check covers one platform always, one sometimes
             * and one never, and an unchecked link that looks identical to a
             * checked one is worse than no check at all.
             */
            autoChecked:
              authorFromUrl(item.url, item.platform as CampaignPlatform) !==
              null,
          }))}
        />
      )}
    </>
  );
}

function LaneChip({
  lane,
  active,
  label,
  count,
}: {
  lane: Lane;
  active: Lane;
  label: string;
  count: number;
}) {
  const on = lane === active;
  return (
    <Link
      href={lane === "all" ? "/admin" : `/admin?lane=${lane}`}
      aria-pressed={on}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
        on
          ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
          : "border-white/20 text-white/60 hover:text-white"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
