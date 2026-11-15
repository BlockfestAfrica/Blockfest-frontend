import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { blockedDomains } from "@/lib/admin/vote-round";
import { BlockedDomainsCard } from "@/components/admin/blocked-domains-card";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Blocked vote domains",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The email domains refused at the Community Favourite vote.
 *
 * Was a card under the vote on Winners. A block is campaign-wide and outlives
 * the round it was made in, so it is its own screen: where an owner lifts
 * one, or blocks a domain before anybody has used it. The automatic-block
 * alert links here.
 */
export default async function VoteDomainsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Results"
        why="A blocked domain refuses every voter on it, so blocking and lifting are restricted to owners."
      />
    );
  }

  const blocks = await blockedDomains(admin.admin);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Results"
        title="Blocked vote domains"
        hint="Votes from these email domains are refused at the Community Favourite ballot, in every round."
      />
      <BlockedDomainsCard
        blocks={blocks.map((b) => ({
          domain: b.domain,
          source: b.source,
          reason: b.reason,
          evidence: b.evidence,
          createdAt: b.createdAt.toISOString(),
          byYou: b.createdByAdminId === admin.admin.adminId,
          by: b.createdByEmail,
          held: b.held,
        }))}
      />
    </div>
  );
}
