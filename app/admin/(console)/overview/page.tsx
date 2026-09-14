import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/admin/session";
import {
  addressClusters,
  campaignMetrics,
  weeklyActivity,
} from "@/lib/admin/metrics";
import { Panel, Pill, Stat } from "@/components/shared/panel";
import { SABILYTICS_SHARE_URL } from "@/lib/sabilytics";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The targets the brief states, so a figure can be read against something. */
const TARGETS = {
  creators: 50,
  submissions: 50,
  approvedUrls: 100,
} as const;

/**
 * Where the campaign actually is.
 *
 * Every number is counted from the rows at the moment it is asked for, never
 * from a stored counter. A counter is a second copy of the truth that drifts the
 * first time something is corrected, and the drift is invisible because a
 * counter always looks like an answer.
 *
 * Open to every admin. These are the numbers the team needs daily and none of
 * them is an action.
 */
export default async function OverviewPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  const [metrics, weeks, clusters] = await Promise.all([
    campaignMetrics(admin.admin),
    weeklyActivity(admin.admin),
    addressClusters(admin.admin),
  ]);

  const pct = (value: number, target: number) =>
    Math.min(100, Math.round((value / target) * 100));

  return (
    <>
      <p className="eyebrow text-brand-gold">Overview</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        Where we are
      </h1>

      {/* mobile-grid-ok: three one-word labels over numbers, two columns below
          sm so no column is narrower than about 150px. */}
      {/* The figure and its meaning as one object. These carried the raw
          count at Stat size while the number that matters, percent of the
          target promised to the sponsor, sat in a prose list below: data as
          presentation. The hint is the story; the ul is gone.
          mobile-grid-ok: short labels over numbers, two per row below sm. */}
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        <Stat
          label="Creators"
          value={metrics.creators}
          hint={`of ${TARGETS.creators} target · ${pct(metrics.creators, TARGETS.creators)}%`}
        />
        <Stat
          label="Submissions"
          value={metrics.submissions}
          hint={`of ${TARGETS.submissions} target · ${pct(metrics.submissions, TARGETS.submissions)}%`}
        />
        <Stat
          label="Approved URLs"
          value={metrics.approvedUrls}
          hint={`of ${TARGETS.approvedUrls} target · ${pct(metrics.approvedUrls, TARGETS.approvedUrls)}% · one per platform`}
        />
      </div>

      {/* mobile-grid-ok: short labels over numbers, two per row below sm. */}
      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat label="Waiting" value={metrics.pending} />
        <Stat label="Rejected" value={metrics.rejected} />
        <Stat label="Silent" value={metrics.silent} />
        <Stat label="Points" value={metrics.pointsAwarded} />
      </div>


      <div className="mt-10">
        <h2 className="text-xl font-bold text-white">By week</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3 text-right">Entries</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-right">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr
                  key={week.weekNo}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">
                      W{week.weekNo}
                    </span>{" "}
                    <span className="text-sm text-ink-3">{week.title}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {week.entries}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {week.submissions}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {week.approved}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-white">
                    {week.pending}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-white">Referrals</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          {metrics.referralsPaid} paid, {metrics.referralsPending} recorded and
          waiting. A referral pays when the creator who was brought in has their
          first approved entry, so a large waiting number means people arrived
          and have not published yet.
        </p>
      </div>

      {clusters.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-white">
            Registrations sharing an address
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
            For a person to look at, never acted on automatically. Nigerian
            mobile carriers put very large numbers of subscribers behind each
            address, so this is far more likely to be two creators on the same
            network than one person with two accounts. It is here because it is
            the only signal in the database that points at the fraud the rules
            forbid, and a human comparing the names and the work can tell those
            apart where a threshold cannot.
          </p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {clusters.map((cluster) => (
              <li key={cluster.ip} className="p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm text-ink-2">
                    {cluster.ip}
                  </span>
                  <Pill tone="bad">{cluster.creators} creators</Pill>
                </div>
                <p className="mt-1 text-sm text-ink-3">
                  {cluster.names.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
       * Stated rather than invented.
       *
       * Impressions is a campaign KPI and is not in this database. On-site
       * traffic is in Sabilytics and reach is in each platform's own analytics,
       * which only the creator can see. A number here would be a guess wearing
       * the clothes of a measurement.
       */}
      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-xl font-bold text-white">Impressions</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          Not measurable from here, and not estimated. On-site traffic is in
          Sabilytics; reach on each post is in that platform&apos;s own analytics
          and only the creator can see it. Any figure this page produced would be
          a guess dressed as a measurement, and it would end up in the report to
          Monica.
        </p>
        {SABILYTICS_SHARE_URL && (
          <a
            href={SABILYTICS_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            Open Sabilytics
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </>
  );
}
