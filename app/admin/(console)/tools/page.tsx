import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { ReissueLink } from "@/components/admin/reissue-link";
import { isOwner } from "@/lib/admin/session";
import { listResources } from "@/lib/admin/resources";
import { ResourcesEditor } from "@/components/admin/resources-editor";
import { LinkCheck } from "@/components/admin/link-check";
import { RepriceEntry } from "@/components/admin/reprice-entry";
import { JobCard, SPACING } from "@/components/shared/panel";

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
    <div className={SPACING.page}>
      <LinkCheck />

      {/* Owner-only from here down. Reissue moved behind the gate in the
          day-one audit: it mints a working session for any creator from
          just their email and rotates their real link away, which with
          handle verification removed is the highest-leverage capability a
          console session holds. Repricing moves money, and resources render
          publicly under the campaign's name. The API refuses reviewers on
          all three independently. */}
      {isOwner(admin.admin) && (
        <>
          <JobCard
            id="reissue"
            title="Give a creator a new link"
            state="now"
            hint="For somebody who has lost the personal link they were given when they registered. Issuing a new one stops the old one working, and emails the new one to the address they registered with."
          >
            <ReissueLink />
          </JobCard>
          <RepriceEntry />
          <ResourcesEditor rows={await listResources(admin.admin)} />
        </>
      )}
    </div>
  );
}
