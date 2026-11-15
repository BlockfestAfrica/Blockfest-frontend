import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { rovvCodeQueue, rovvCounts, rovvHeldCodes } from "@/lib/admin/rovv";
import { RovvCodePaste, RovvTestTools } from "@/components/admin/rovv-queue";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, Pill, SectionCard, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "ROVV: try it yourself",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Test entries, so an owner can walk the whole ROVV flow, winner email and
 * all, without touching a real entrant. Was a card on the ROVV page between
 * the winners and the entries; owners only, as before.
 */
export default async function RovvTestingPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="ROVV"
        why="Test entries can be picked and sent a real winner email, so they are restricted to owners."
      />
    );
  }

  const [counts, testCodeQueue, heldCodes] = await Promise.all([
    rovvCounts(admin.admin),
    rovvCodeQueue(admin.admin, true),
    rovvHeldCodes(admin.admin),
  ]);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="ROVV"
        title="Try it yourself"
        hint="Walk the whole ROVV flow on test entries, winner email included, without touching a real entrant."
      />
      <SectionCard
        id="testing"
        title="Test entries"
        aside={counts.tests > 0 ? <Pill tone="neutral">{counts.tests} test {counts.tests === 1 ? "entry" : "entries"}</Pill> : undefined}
      >
        <div className="mt-3">
          <RovvTestTools tests={counts.tests} />
        </div>
        {counts.testNeedCode > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <RovvCodePaste waiting={counts.testNeedCode} queue={testCodeQueue} held={heldCodes} test />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
