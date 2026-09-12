import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { participantCounts, participants } from "@/lib/admin/participants";
import { ParticipantsTable } from "@/components/admin/participants-table";
import { Stat } from "@/components/shared/panel";
import { campaigns as allCampaigns, MONICA_SLUG } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Participants",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 500;

/**
 * Everyone enrolled, whether or not they have submitted anything.
 *
 * The review queue only shows work that has arrived, so a creator who
 * registered and went quiet was invisible: no way to ask how many had joined,
 * who had gone silent, or who to chase before a brief closed.
 *
 * The headline figures come from their own count query rather than from the
 * length of the page. They used to be derived from the returned array, which is
 * capped, so the page presented a page size as a population and the copy turned
 * that into an outreach decision.
 *
 * Search is a real GET form. The ilike matching has always been in the query and
 * applied in SQL before the limit, and was dead because nothing ever passed a
 * search term: somebody outside the first 500 could not be found at all, which
 * is exactly the moment somebody writes in asking to be looked up.
 */
export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; q?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const params = await searchParams;
  // Only a slug this site actually publishes. An unknown one returns nobody
  // rather than being passed through to the query.
  const known = allCampaigns.map((c) => c.slug);
  const slug =
    params.campaign && known.includes(params.campaign)
      ? params.campaign
      : MONICA_SLUG;

  const search = params.q?.trim() || undefined;

  const [rows, counts] = await Promise.all([
    participants(admin.admin, { slug, limit: PAGE_SIZE, search }),
    participantCounts(admin.admin, slug),
  ]);

  return (
    <>
      <p className="eyebrow text-brand-gold">People</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        {counts.joined} joined
      </h1>

      {/* mobile-grid-ok: four one-word labels over numbers; two columns below
          sm, four above, so no column is ever narrower than about 150px. */}
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat label="Joined" value={counts.joined} />
        <Stat label="Submitted" value={counts.submitted} />
        <Stat label="Silent" value={counts.silent} />
        <Stat label="Points" value={counts.points} />
      </div>

      {counts.joined === 0 ? (
        /*
         * Nothing to search, filter, sort or switch between.
         *
         * Every control below is chrome for data that does not exist, and on a
         * phone it was four stacked rows of it above an empty table. The screen
         * earns them back the moment somebody registers.
         */
        <p className="mt-8 max-w-prose text-base leading-relaxed text-white/60">
          Nobody has registered yet. Everyone who joins appears here, whether or
          not they have submitted anything.
        </p>
      ) : (
        <>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-white/60">
            {counts.silent} {counts.silent === 1 ? "has" : "have"} not submitted
            anything yet. That is the group worth a message before a brief
            closes.
          </p>

          {/*
           * One form, one button.
           *
           * The search and the campaign switcher were two separate GET forms
           * with a button each, which on a phone is four stacked full-width
           * rows before any data. They submit together now.
           *
           * The search runs in SQL before the limit and matches name, email and
           * handle, so it reaches somebody outside the page window. The chips
           * inside the table narrow only what is already on screen, and say so.
           */}
          <form method="get" className="mt-6 flex flex-col gap-2">
            <label htmlFor="q" className="sr-only">
              Search by name, email or handle
            </label>
            <div className="flex gap-2">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={search ?? ""}
                placeholder="Name, email or handle"
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-base text-white placeholder:text-white/55 focus:border-brand-gold focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10"
              >
                Search
              </button>
            </div>

            {allCampaigns.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="campaign" className="text-sm text-white/60">
                  Campaign
                </label>
                <select
                  id="campaign"
                  name="campaign"
                  defaultValue={slug}
                  className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg border border-white/20 bg-ground px-3 text-sm text-white focus:border-brand-gold focus:outline-none sm:flex-none"
                >
                  {allCampaigns.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>

          {search && (
            <p className="mt-3 text-sm text-white/60">
              {rows.length} {rows.length === 1 ? "match" : "matches"} for “
              {search}”.{" "}
              <a
                href={
                  slug === MONICA_SLUG
                    ? "/admin/participants"
                    : `/admin/participants?campaign=${slug}`
                }
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Clear
              </a>
            </p>
          )}

          {!search && rows.length === PAGE_SIZE && (
            <p className="mt-3 text-sm text-white/60">
              Showing the {PAGE_SIZE} most recent. Search to reach anybody else.
            </p>
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
        </>
      )}
    </>
  );
}
