import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { pendingSubmissions } from "@/lib/admin/review";
import { ReviewQueue } from "@/components/admin/review-queue";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

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
            <h1 className="text-display-sm font-bold text-white">Admin</h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
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
  const queue = await pendingSubmissions(admin.admin);

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="text-display-sm font-bold text-white">
              Review queue
            </h1>
            <p className="text-sm text-white/50">
              {admin.admin.email} · {admin.admin.role}
            </p>
          </div>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Oldest first, so the creators who entered on day one are not the ones
            left waiting. Approving mints points against a 5,000,000 naira pool
            and is recorded against your name.
          </p>

          {queue.length === 0 ? (
            <p className="mt-10 max-w-2xl rounded-xl border border-white/15 p-6 text-base leading-relaxed text-white/60">
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
              }))}
            />
          )}
        </div>
      </section>
    </main>
  );
}
