import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { ReissueLink } from "@/components/admin/reissue-link";
import { OwnersOnly } from "@/components/admin/owners-only";
import { JobCard, PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "New personal link",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Give a creator a new personal link. Was on Tools.
 *
 * Owners only since the day-one audit: it mints a working session for any
 * creator from just their email and rotates their real link away, which with
 * handle verification removed is the highest-leverage capability a console
 * session holds. The route refuses reviewers on its own as well.
 */
export default async function ReissuePage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Creators"
        why="A new link signs in as the creator and stops their old one working, so it is restricted to owners."
      />
    );
  }

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Creators"
        title="New personal link"
        hint="For a creator who lost the link they were given when they registered, and could not get back in with Lost your link?."
      />
      <JobCard
        id="reissue"
        title="Give a creator a new link"
        state="now"
        hint="Issuing a new one stops the old one working, and emails the new one to the address they registered with."
      >
        <ReissueLink />
      </JobCard>
    </div>
  );
}
