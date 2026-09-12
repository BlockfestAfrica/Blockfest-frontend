import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { pauseState } from "@/lib/campaign-pause";
import { PurgePanel } from "@/components/admin/purge-panel";
import { Panel } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Clear the test data",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Clearing the campaign, on a route of its own.
 *
 * Every condition is checked here and again in the database, which is the one
 * that counts: active owner, campaign paused, campaign not yet open. This page
 * refuses early so nobody is shown a control that cannot work, and refuses on
 * the same grounds so the two never disagree.
 */
export default async function ClearPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const pause = await pauseState();
  const beforeLaunch = pause.startsAt !== null && pause.startsAt > new Date();
  const allowed = isOwner(admin.admin) && beforeLaunch;

  return (
    <>
      <Link
        href="/admin/campaign"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Campaign
      </Link>

      <h1 className="mt-6 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        Clear the test data
      </h1>

      {!allowed ? (
        <Panel tone="quiet" className="mt-8">
          <p className="max-w-prose text-base leading-relaxed text-white/70">
            {!isOwner(admin.admin)
              ? "This is restricted to owners."
              : "The campaign has opened. Everything in it now belongs to somebody who entered, so it cannot be cleared from here."}
          </p>
        </Panel>
      ) : (
        <Panel tone="danger" className="mt-8">
          <PurgePanel paused={pause.paused} />
        </Panel>
      )}
    </>
  );
}
