import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { ReissueLink } from "@/components/admin/reissue-link";
import { isOwner } from "@/lib/admin/session";
import { listResources } from "@/lib/admin/resources";
import { ResourcesEditor } from "@/components/admin/resources-editor";
import { LinkCheck } from "@/components/admin/link-check";
import { SectionHeading } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Tools",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Support work, on its own page.
 *
 * Reissuing a link, pausing the campaign and clearing the database were three
 * blocks stacked under the review queue, rendered from near-identical markup:
 * the same rule, the same eyebrow, the same heading size, one input and one
 * button. Giving somebody a new link and permanently deleting every creator and
 * every point looked equally weighty and sat a thumb apart.
 *
 * Reissue is ordinary support, so it is here and every role can reach it. The
 * two owner controls are on the Campaign tab, and the destructive one is a
 * further route beyond that.
 */
export default async function ToolsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  return (
    <>
      <SectionHeading
        label="Support"
        title="Give a creator a new link"
        hint="For somebody who has lost the personal link they were given when they registered. Issuing a new one stops the old one working, and emails the new one to the address they registered with."
      />
      <ReissueLink />

      <div className="mt-8">
        <LinkCheck />
      </div>

      {/* Owner-only: these render on the public pack page under the
          campaign's name. */}
      {isOwner(admin.admin) && (
        <div className="mt-8">
          <ResourcesEditor rows={await listResources(admin.admin)} />
        </div>
      )}
    </>
  );
}
