import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { listChallenges } from "@/lib/admin/challenges";
import { listPointRules } from "@/lib/admin/point-rules";
import { PointRulesEditor } from "@/components/admin/point-rules-editor";
import { RepriceEntry } from "@/components/admin/reprice-entry";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SPACING } from "@/components/shared/panel";
import { currentWeekNo } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Points",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * What points are worth, and the one tool that moves an existing entry to
 * the current rates. The rates were on Campaign and the repricing on Tools;
 * they are the same question, so they are one screen.
 */
export default async function PointsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return <OwnersOnly context="Monica · Setup" why="Point values decide how the prize pool is split, so they are restricted to owners." />;
  }

  const [challenges, rules] = await Promise.all([listChallenges(admin.admin), listPointRules(admin.admin)]);
  const thisWeek = challenges.find((c) => c.weekNo === currentWeekNo());

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Setup"
        title="Points"
        hint="A rate change applies to entries from then on. Entries already scored keep what they were given unless you reprice them one at a time."
      />
      <PointRulesEditor rules={rules} weekBase={thisWeek?.basePoints ?? 100} />
      <RepriceEntry />
    </div>
  );
}
