import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { pendingSubmissions } from "@/lib/admin/review";
import { ReviewQueue } from "@/components/admin/review-queue";
import { ReissueLink } from "@/components/admin/reissue-link";
import { PauseSwitch } from "@/components/admin/pause-switch";
import { PurgePanel } from "@/components/admin/purge-panel";
import { pauseState } from "@/lib/campaign-pause";
import { isOwner } from "@/lib/admin/session";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { authorFromUrl } from "@/lib/campaign-submission";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Never prerendered, never cached.
 *
 * The page is a function of who is signed in, and it shows creator contact
 * details and unreviewed submissions. A cached render is one admin's queue
 * handed to the next visitor.
 *
 * The service worker is the other half of that, and it does not read these
 * exports: /admin is excluded there explicitly, because the worker caches page
 * navigations to disk with no expiry and nothing in the application can reach
 * into that cache to clear it.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQueuePage() {
  const admin = await requireAdmin();

  // One answer for everybody who is not a current admin: not signed in,
  // unknown, revoked, or signed in on a different Netlify account.
  if (!admin.ok) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-md">
            <p className="eyebrow text-brand-gold">Blockfest Africa</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Admin
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/55">
              You need to sign in to see this.
            </p>
            <Link
              href="/admin/login"
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // The type is the proof that the guard ran: pendingSubmissions cannot be
  // called without it.
  const [queue, pause] = await Promise.all([
    pendingSubmissions(admin.admin),
    pauseState(),
  ]);

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-brand-gold">Review</p>
              <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
                {queue.length} waiting
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/admin/participants"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                All participants
              </Link>
              <p className="text-sm text-white/40">
                {admin.admin.email} · {admin.admin.role}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-prose text-sm leading-relaxed text-white/50">
            Oldest first. Approving mints points against the prize pool and is
            recorded against your name.
          </p>

          {queue.length === 0 ? (
            <p className="mt-10 max-w-prose text-base leading-relaxed text-white/50">
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
                /*
                 * Whether the server could check the link against the handle.
                 *
                 * X always carries the author in the path, TikTok only in its
                 * full web form and not in a vm. or vt. share link, and
                 * Instagram never. So the automatic check covers one platform
                 * always, one sometimes, and one never, and until now a
                 * reviewer could not tell which they were looking at. An
                 * unchecked link that looks identical to a checked one is worse
                 * than no check at all.
                 */
                autoChecked:
                  authorFromUrl(item.url, item.platform as CampaignPlatform) !==
                  null,
              }))}
            />
          )}

          <ReissueLink />

          {/* Owners only. Pausing stops every creator entering, which is a
              bigger action than approving one entry, and is the first place
              the owner and reviewer distinction is actually used. */}
          {isOwner(admin.admin) && (
            <>
              <PauseSwitch paused={pause.paused} reason={pause.reason} />

              {/* Only before the campaign opens. The database refuses a purge
                  after starts_at regardless, so this is about not showing a
                  button that cannot work rather than about stopping anything.
                  An unreadable date counts as open: everywhere else an unknown
                  answer means the campaign is running, but the one destructive
                  action fails closed. */}
              {pause.startsAt !== null && pause.startsAt > new Date() && (
                <PurgePanel paused={pause.paused} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
