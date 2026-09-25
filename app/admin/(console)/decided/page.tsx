import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import {
  decidedCounts,
  decidedSubmissions,
  type DecidedStatus,
} from "@/lib/admin/review";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  PageHeader,
  Pill,
  selectControl,
} from "@/components/shared/panel";
import { DecidedList } from "@/components/admin/decided-list";
import { dateTime } from "@/lib/format";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Decided",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Rows fetched per view. The list reveals them ten at a time. */
const PAGE_SIZE = 200;

const STATUSES: { value: DecidedStatus; label: string }[] = [
  { value: "all", label: "Approved and rejected" },
  { value: "approved", label: "Approved only" },
  { value: "rejected", label: "Rejected only" },
];

const WEEKS = [1, 2, 3, 4];

/**
 * What has already been decided, and the link each decision was about.
 *
 * The queue only ever showed what was waiting, so a decision left no trace
 * anywhere a reviewer could reach. That matters because approving is effectively
 * irreversible: it mints points and emails the creator, and while the opposite
 * decision can still be sent, nothing puts a submission back to waiting.
 *
 * It is also where an approved post is found again. The page used to show who
 * decided and when but not the post itself, so checking later that an approved
 * link was still up, or still said what it said, meant finding it somewhere
 * else. And it showed only the newest fifty, so an approval from the first week
 * had fallen off by the second. Search and the filters run in SQL before the
 * limit, the way the People screen's search does, so any decision can be found.
 */
export default async function DecidedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; week?: string; q?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const params = await searchParams;
  // Only values the form offers. Anything else is the default, not a query.
  const status: DecidedStatus = STATUSES.some((s) => s.value === params.status)
    ? (params.status as DecidedStatus)
    : "all";
  const weekNo = WEEKS.includes(Number(params.week))
    ? Number(params.week)
    : undefined;
  const search = params.q?.trim().slice(0, 100) || undefined;
  const filtered = status !== "all" || weekNo !== undefined || !!search;

  const [decided, counts] = await Promise.all([
    decidedSubmissions(admin.admin, {
      status,
      weekNo,
      search,
      limit: PAGE_SIZE,
    }),
    decidedCounts(admin.admin),
  ]);
  const total = counts.approved + counts.rejected;

  return (
    <>
      {/* The place, not a count: "Last 47" changed with every decision and
          told a returning reviewer nothing about where they were. Same rule
          the People screen already follows. The totals are their own query,
          so they are the population rather than the page. */}
      <PageHeader
        context="Review"
        title="Decided"
        hint={`Newest first. ${counts.approved} approved and ${counts.rejected} rejected so far. Every decision is here with its link, so an approved post can be opened again later.`}
      />

      {total === 0 ? (
        <p className="mt-8 max-w-prose text-base leading-relaxed text-ink-3">
          Nothing decided yet.
        </p>
      ) : (
        <>
          {/* One job: find a decision. A real GET form, so a filtered view is
              a URL that can be shared or reloaded, and the matching runs in
              SQL across every decision rather than the rows on screen. */}
          <div className="mt-8">
            <JobCard
              id="find"
              title="Find a decision"
              state="todo"
              status={
                filtered ? (
                  <Pill>
                    {decided.length === PAGE_SIZE
                      ? `First ${PAGE_SIZE} matches`
                      : `${decided.length} ${decided.length === 1 ? "match" : "matches"}`}
                  </Pill>
                ) : undefined
              }
            >
              <form method="get" className="space-y-4">
                <Field id="q" label="Creator, handle or part of the link">
                  <input
                    id="q"
                    name="q"
                    type="search"
                    defaultValue={search ?? ""}
                    maxLength={100}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Ada, @adawrites, status/1234"
                    className={control}
                  />
                </Field>

                {/* mobile-grid-ok: two short selects; one column below sm, so
                    neither is ever narrower than the screen allows. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="status" label="Decision">
                    <select
                      id="status"
                      name="status"
                      defaultValue={status}
                      className={selectControl}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="week" label="Week">
                    <select
                      id="week"
                      name="week"
                      defaultValue={weekNo ? String(weekNo) : ""}
                      className={selectControl}
                    >
                      <option value="">Every week</option>
                      {WEEKS.map((w) => (
                        <option key={w} value={String(w)}>
                          Week {w}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button type="submit" className={buttonClass("secondary")}>
                    Show
                  </button>
                  {filtered && (
                    <a
                      href="/admin/decided"
                      className="inline-flex min-h-11 items-center text-sm text-link underline underline-offset-2 hover:text-white"
                    >
                      Clear
                    </a>
                  )}
                </div>
              </form>
            </JobCard>
          </div>

          {decided.length === 0 ? (
            <p className="mt-8 max-w-prose text-base leading-relaxed text-ink-3">
              No decision matches that.
            </p>
          ) : (
            <DecidedList
              items={decided.map((item) => ({
                id: item.id,
                status: item.status,
                creatorName: item.creatorName,
                weekNo: item.weekNo,
                challengeTitle: item.challengeTitle,
                platformLabel:
                  platformLabels[item.platform as CampaignPlatform] ??
                  item.platform,
                url: item.url,
                reviewerEmail: item.reviewerEmail,
                reviewedAtLabel: item.reviewedAt
                  ? dateTime(item.reviewedAt)
                  : null,
                reviewNote: item.reviewNote,
              }))}
            />
          )}
        </>
      )}

      {/* Honest about what "changing a decision" actually does. There is no
          undo: the creator has already been told, and nothing returns a
          submission to waiting. */}
      <details className="mt-10">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2 hover:text-white">
          Can a decision be changed?
        </summary>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
          Only by sending the opposite decision, which is not an undo. A creator
          who was approved has already been emailed that they were approved and
          will then be emailed that they were rejected, and their points move
          accordingly. Nothing puts a submission back to waiting. If a decision
          was wrong, the honest fix is usually a manual points adjustment on the
          People tab with the reason written down.
        </p>
      </details>
    </>
  );
}
