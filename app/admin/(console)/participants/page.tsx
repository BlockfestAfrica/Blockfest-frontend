import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { participantCounts, participants } from "@/lib/admin/participants";
import { pendingHandleRequests } from "@/lib/admin/handle-requests";
import { HandleRequestQueue } from "@/components/admin/handle-request-queue";
import { ParticipantsTable } from "@/components/admin/participants-table";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  PageHeader,
  Pill,
  selectControl,
  SPACING,
  Stat,
} from "@/components/shared/panel";
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

  const owner = isOwner(admin.admin);

  const [rows, counts, requests] = await Promise.all([
    participants(admin.admin, { slug, limit: PAGE_SIZE, search }),
    participantCounts(admin.admin, slug),
    // Owners decide these, so only owners load them.
    owner
      ? pendingHandleRequests(admin.admin).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <div className={SPACING.page}>
      {/*
       * The heading is the place, not a number.
       *
       * It used to read "417 joined", which made the page title change every
       * time somebody registered and put the same figure twice on one screen:
       * once as an h1 and again as the first of four Stats directly below it.
       * A heading answers where you are. The Stats answer how many.
       */}
      <PageHeader
        context="Monica"
        title="People"
        hint="Everyone enrolled, whether or not they have submitted anything. The review queue only shows work that has arrived."
      >
        {/* mobile-grid-ok: four one-word labels over numbers; two columns below
            sm, four above, so no column is ever narrower than about 150px. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat label="Joined" value={counts.joined} />
          <Stat label="Submitted" value={counts.submitted} />
          <Stat label="Silent" value={counts.silent} />
          <Stat label="Points" value={counts.points} />
        </div>
      </PageHeader>

      {owner && requests.length > 0 && (
        <HandleRequestQueue
          requests={requests.map((r) => ({
            id: r.id,
            creatorName: r.creatorName,
            creatorEmail: r.creatorEmail,
            platform: r.platform,
            oldHandle: r.oldHandle,
            requestedHandle: r.requestedHandle,
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      )}

      {counts.joined === 0 ? (
        /*
         * Nothing to search, filter, sort or switch between.
         *
         * Every control below is chrome for data that does not exist, and on a
         * phone it was four stacked rows of it above an empty table. The screen
         * earns them back the moment somebody registers.
         */
        <p className="max-w-prose text-base leading-relaxed text-white/70">
          Nobody has registered yet. Everyone who joins appears here, whether or
          not they have submitted anything.
        </p>
      ) : (
        <>
          {/*
           * One job: find somebody.
           *
           * The search box, its button and the campaign switcher were three
           * controls loose on the page between the figures and the table, which
           * on a phone is four stacked full-width rows before any data. They are
           * one form with one button, inside one named card.
           *
           * The search runs in SQL before the limit and matches name, email and
           * handle, so it reaches somebody outside the page window. The chips
           * inside the table narrow only what is already on screen, and say so.
           */}
          <JobCard
            id="find"
            title="Find somebody"
            state="todo"
            hint={
              search
                ? undefined
                : `Searches every registration, not just the ${PAGE_SIZE} on this page.`
            }
            status={
              search ? (
                <Pill>
                  {rows.length} {rows.length === 1 ? "match" : "matches"}
                </Pill>
              ) : undefined
            }
          >
            <form method="get" className="space-y-4">
              <Field
                id="q"
                label="Name, email or handle"
                hint={
                  search ? `Showing matches for “${search}”.` : undefined
                }
              >
                <div className="flex gap-2">
                  <input
                    id="q"
                    name="q"
                    type="search"
                    defaultValue={search ?? ""}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Ada, ada@example.com, @adawrites"
                    className={`${control} flex-1`}
                  />
                  <button
                    type="submit"
                    className={buttonClass("secondary", "shrink-0")}
                  >
                    Search
                  </button>
                </div>
              </Field>

              {allCampaigns.length > 1 && (
                <Field id="campaign" label="Campaign">
                  <select
                    id="campaign"
                    name="campaign"
                    defaultValue={slug}
                    className={selectControl}
                  >
                    {allCampaigns.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {search && (
                <a
                  href={
                    slug === MONICA_SLUG
                      ? "/admin/participants"
                      : `/admin/participants?campaign=${slug}`
                  }
                  className="inline-block text-sm text-link underline underline-offset-2 hover:text-white"
                >
                  Clear the search
                </a>
              )}
            </form>
          </JobCard>

          <section aria-labelledby="everyone" className="space-y-4">
            <h2 id="everyone" className="text-xl font-bold text-white">
              {search ? "Matches" : "Everyone"}
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-white/70">
              {counts.silent} {counts.silent === 1 ? "has" : "have"} not
              submitted anything yet. That is the group worth a message before a
              brief closes.
              {!search && rows.length === PAGE_SIZE && (
                <>
                  {" "}
                  This page holds the {PAGE_SIZE} most recent. Search to reach
                  anybody else.
                </>
              )}
            </p>

            <ParticipantsTable
              canCorrectHandles={owner}
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
          </section>
        </>
      )}
    </div>
  );
}
