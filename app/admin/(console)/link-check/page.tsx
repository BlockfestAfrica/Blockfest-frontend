import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { LinkCheck } from "@/components/admin/link-check";
import { PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Approved links",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Whether the approved entries are still up. Was the first card on Tools;
 * every admin can run it, as before.
 */
export default async function LinkCheckPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Review"
        title="Approved links"
        hint="A post taken down after it was approved still holds its points. This finds the ones the platform says are gone."
      />
      <LinkCheck />
    </div>
  );
}
