import { ExternalLink } from "lucide-react";
import { SectionCard, Stat } from "@/components/shared/panel";
import { DP_ROLES, roleCopy, type DPRole } from "@/app/getdp/lib/dp";
import type { DPChannel } from "@/app/getdp/lib/count";
import type { DpGenerations } from "@/lib/admin/metrics";
import { count as formatCount } from "@/lib/format";

/** How each channel reads to the team: the button or app a person tapped. */
export const CHANNEL_LABEL: Record<DPChannel, string> = {
  download: "Download PNG",
  share: "Share your DP (phone)",
  more: "Share… (computer)",
  photos: "Save to Photos",
  save: "Save image (in an app)",
  status: "WhatsApp Status",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

const roleLabel = (name: string) =>
  (DP_ROLES as readonly string[]).includes(name) ? roleCopy(name as DPRole).label : name;
const channelLabel = (name: string) => CHANNEL_LABEL[name as DPChannel] ?? name;

function Breakdown({
  caption,
  rows,
  label,
}: {
  caption: string;
  rows: { name: string; count: number }[];
  label: (name: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-3">
            <th scope="col" className="px-4 py-3">
              {caption}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              DPs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-sm text-ink-2">{label(row.name)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-white">{formatCount(row.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The DPs made on /getdp, for the overview: counted in our own database, one
 * row per DP, so an ad blocker cannot hide one. Who tapped what, device by
 * device, is in Sabilytics.
 */
export function DpGenerationsCard({
  dps,
  sabilyticsUrl,
}: {
  dps: DpGenerations;
  sabilyticsUrl?: string;
}) {
  return (
    <SectionCard id="dps" title="DPs generated" className="mt-10">
      {/* mobile-grid-ok: two short labels over numbers. */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        <Stat label="All time" value={formatCount(dps.total)} />
        <Stat label="Today" value={formatCount(dps.today)} hint="since midnight in Lagos" />
      </div>
      {dps.total > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Breakdown caption="Role" rows={dps.byRole} label={roleLabel} />
          <Breakdown caption="Shared or saved by" rows={dps.byChannel} label={channelLabel} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-3">None yet.</p>
      )}
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-3">
        A DP is counted once, the first time its photo, as that role, is
        downloaded, shared or saved on /getdp. No name or photo is recorded.
        Who tapped what, and on which device, is in Sabilytics under
        getdp_dp_generated and getdp_share_clicked.
      </p>
      {sabilyticsUrl && (
        <a
          href={sabilyticsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
        >
          Open Sabilytics
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </SectionCard>
  );
}
