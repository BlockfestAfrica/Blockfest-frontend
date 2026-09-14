import type { Metadata } from "next";
import Link from "next/link";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { pauseState } from "@/lib/campaign-pause";
import { PauseSwitch } from "@/components/admin/pause-switch";
import { listChallenges } from "@/lib/admin/challenges";
import { ChallengeEditor } from "@/components/admin/challenge-editor";

export const metadata: Metadata = {
  title: "Campaign",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Starting and stopping the campaign.
 *
 * Owners only, checked here as well as by the tab being absent. A hidden tab is
 * a tidy interface, not a permission: the route has to refuse a reviewer who
 * types the URL, and the API behind it refuses independently again.
 */
export default async function CampaignPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <>
        <h1 className="text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
          Owners only
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-white/60">
          Starting and stopping the campaign is restricted to owners. Everything
          else in the console is open to you.
        </p>
      </>
    );
  }

  const [pause, challenges] = await Promise.all([pauseState(), listChallenges(admin.admin)]);
  const beforeLaunch =
    pause.startsAt !== null && pause.startsAt > new Date();

  return (
    <>
      <p className="eyebrow text-brand-gold">Campaign</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        {pause.paused ? "Paused" : "Running"}
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
        {pause.paused
          ? `Nobody can register or submit. Creators are being told: ${pause.reason ?? "no reason recorded"}. They can still read the rules, the brief and the leaderboard.`
          : "Registration and submissions are open. Pausing takes effect on a creator's next click, not on the next deploy."}
      </p>

      {/* A fixed height across both states. The running form is tall and the
          paused state is one button, so without this, flipping the switch moves
          everything below it under whatever finger just tapped. */}
      <div className="mt-8 min-h-[14rem]">
        <PauseSwitch paused={pause.paused} />
      </div>

      {/* The weekly briefs, right where starting and stopping already lives,
          because writing Monday's brief is the other thing an owner does here
          every week (#67). */}
      <div className="mt-12">
        <ChallengeEditor
          challenges={challenges.map((challenge) => ({
            id: challenge.id,
            weekNo: challenge.weekNo,
            title: challenge.title,
            description: challenge.description,
            basePoints: challenge.basePoints,
            status: challenge.status,
            startsAt: challenge.startsAt.toISOString(),
            endsAt: challenge.endsAt.toISOString(),
            readonly_: challenge.endsAt < new Date(),
          }))}
        />
      </div>

      {/*
       * The destructive control is a link, not a control.
       *
       * It used to sit directly below the pause switch, which meant pausing
       * both armed the purge and reflowed the page so it arrived under the
       * finger that had just tapped. On its own route that is impossible.
       *
       * Offered only once the campaign is paused and only before it opens,
       * which are the same two conditions the database enforces.
       */}
      {beforeLaunch && pause.paused && (
        <div className="mt-12 border-t border-white/12 pt-8">
          <Link
            href="/admin/campaign/clear"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-red-300 underline underline-offset-4 hover:text-red-200"
          >
            Clear the test data
          </Link>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/55">
            Deletes every creator, entry and point in this campaign. Stops
            working the moment registration opens.
          </p>
        </div>
      )}
    </>
  );
}
