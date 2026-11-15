import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { addressClusters } from "@/lib/admin/metrics";
import { AddressClusters } from "@/components/admin/address-clusters";
import { PageHeader, SectionCard, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Shared addresses",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Registrations that came from the same address, for a person to look at.
 *
 * Was the last card on Overview, shown only while there were any, so there
 * was nowhere to go to check and it sat among figures as if it were one. It
 * is a list to work through, beside the people it is about. Open to every
 * admin, as it was; nothing here acts on anybody.
 */
export default async function SharedAddressesPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const clusters = await addressClusters(admin.admin);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Creators"
        title="Shared addresses"
        hint="Registrations that came from the same internet address. For a person to look at, never acted on automatically."
      />
      {clusters.length === 0 ? (
        <p className="max-w-prose text-base leading-relaxed text-ink-2">
          No two registrations share an address. Any that do appear here.
        </p>
      ) : (
        <SectionCard id="clusters" title={`${clusters.length} shared ${clusters.length === 1 ? "address" : "addresses"}`}>
          <details className="mt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2 hover:text-white">
              Why a shared address is usually innocent
            </summary>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
              Nigerian mobile carriers put very large numbers of subscribers
              behind each address, so this is far more likely to be two
              creators on the same network than one person with two accounts.
              It is here because it is the only signal in the database that
              points at the fraud the rules forbid, and a human comparing the
              names and the work can tell those apart where a threshold
              cannot.
            </p>
          </details>
          <AddressClusters
            clusters={clusters.map((cluster) => ({
              ip: cluster.ip,
              creators: cluster.creators,
              names: cluster.names,
            }))}
          />
        </SectionCard>
      )}
    </div>
  );
}
