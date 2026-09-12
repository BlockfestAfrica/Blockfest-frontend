import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/session";
import { participants, participantTotals } from "@/lib/admin/participants";
import { ParticipantsTable } from "@/components/admin/participants-table";
import { campaigns as allCampaigns, MONICA_SLUG } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Participants",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Everyone enrolled, whether or not they have submitted anything.
 *
 * The review queue only shows work that has arrived, so a creator who
 * registered and went quiet was invisible: there was no way to ask how many
 * people had joined, who had gone silent, or who to chase before a brief
 * closed.
 *
 * The campaign is a query parameter rather than a hardcoded slug, because a
 * second campaign is coming and a page that only ever answers for one is a page
 * that gets copied rather than reused.
 */
export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-md">
            <p className="eyebrow text-brand-gold">Blockfest Africa</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Admin
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/55">
              You need to sign in to see this.
            </p>
            <Link
              href="/admin/login"
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  // Only a slug this site actually publishes. An unknown one returns nobody
  // rather than being passed through to the query.
  const known = allCampaigns.map((c) => c.slug);
  const slug =
    params.campaign && known.includes(params.campaign)
      ? params.campaign
      : MONICA_SLUG;

  const rows = await participants(admin.admin, { slug, limit: 500 });
  const totals = participantTotals(rows);

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Review queue
          </Link>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-brand-gold">Participants</p>
              <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
                {totals.total} joined
              </h1>
            </div>
            <p className="text-sm text-white/40">
              {admin.admin.email} · {admin.admin.role}
            </p>
          </div>

          <p className="mt-4 max-w-prose text-sm leading-relaxed text-white/50">
            {totals.silent} have not submitted anything yet. That is the group
            worth a message before a brief closes.
          </p>

          {/* Campaign switcher, shown only once there is more than one. */}
          {allCampaigns.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {allCampaigns.map((c) => (
                <Link
                  key={c.slug}
                  href={`/admin/participants?campaign=${c.slug}`}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                    c.slug === slug
                      ? "border-brand-gold/50 bg-brand-gold/10 text-brand-gold"
                      : "border-white/15 text-white/60 hover:bg-white/5"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          <ParticipantsTable
            rows={rows.map((row) => ({
              enrolmentId: row.enrolmentId,
              name: row.name,
              email: row.email,
              joinedAt: row.joinedAt.toISOString(),
              handles: row.handles,
              submitted: row.submitted,
              approved: row.approved,
              points: row.points,
              active: row.active,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
