import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { listResources } from "@/lib/admin/resources";
import { ResourcesEditor } from "@/components/admin/resources-editor";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Pack resources",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The Resources list on the campaign page. Was on Tools; owners only, as before. */
export default async function ResourcesPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Setup"
        why="Resources render publicly under the campaign's name, so editing them is restricted to owners."
      />
    );
  }

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Setup"
        title="Pack resources"
        hint="What creators see under Resources on the campaign page."
      />
      <ResourcesEditor rows={await listResources(admin.admin)} />
    </div>
  );
}
