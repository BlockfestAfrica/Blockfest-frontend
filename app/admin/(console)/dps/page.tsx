import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { dpGenerations } from "@/lib/admin/metrics";
import { DpGenerationsCard } from "@/components/admin/dp-generations";
import { PageHeader } from "@/components/shared/panel";
import { SABILYTICS_SHARE_URL } from "@/lib/sabilytics";

export const metadata: Metadata = {
  title: "DPs generated",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The DPs made on /getdp. Was a card on Monica's overview, but /getdp is the
 * event's, not the campaign's, so it sits under Outreach. Open to every
 * admin, as it was.
 */
export default async function DpsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  return (
    <>
      <PageHeader
        context="Outreach"
        title="DPs generated"
        hint="Every DP made on /getdp, counted in our own database."
      />
      <DpGenerationsCard dps={await dpGenerations(admin.admin)} sabilyticsUrl={SABILYTICS_SHARE_URL || undefined} />
    </>
  );
}
