import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { snapshotRows } from "@/lib/admin/winners";
import { PageHeader, SectionCard } from "@/components/shared/panel";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Recorded standings",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * One frozen snapshot, readable.
 *
 * The winners page listed what had been recorded but gave no way to open
 * one, so the freeze was a promise the console could not show being kept.
 * Owners only, like the page that links here: the snapshot is the payout
 * record.
 */
export default async function SnapshotPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; version?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <PageHeader
        context="Winners"
        title="Owners only"
        hint="Recorded standings are part of the payout record, so they are restricted to owners."
      />
    );
  }

  const params = await searchParams;
  // Clamped parses, because this arrives from a URL anybody can type.
  const weekNo = Math.min(5, Math.max(1, Number(params.week) || 1));
  const version = Math.min(99, Math.max(1, Number(params.version) || 1));
  const rows = await snapshotRows(admin.admin, weekNo, version);

  return (
    <>
      <Link
        href="/admin/winners"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Winners
      </Link>

      <div className="mt-6">
        <PageHeader
          context={`Week ${weekNo}${version > 1 ? ` · version ${version}` : ""}`}
          title="Recorded standings"
          hint={
            rows.length > 0
              ? `${rows.length} creators as they stood at ${dateTime(rows[0].takenAt)}. This exact table is what the week's prizes were settled against.`
              : "Nothing recorded under this week and version."
          }
        />
      </div>

      {rows.length > 0 && (
        <SectionCard id="standings" className="mt-8">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-3">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Creator</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.rank}-${row.name}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums text-ink-2">
                      {row.rank}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                      {row.points}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                      {row.approved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}
