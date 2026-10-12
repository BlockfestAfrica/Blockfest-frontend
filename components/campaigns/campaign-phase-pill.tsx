"use client";

import { useEffect, useState } from "react";
import { campaignPhase, type Campaign, type CampaignPhase } from "@/lib/campaigns";

/**
 * "Open now", "Opens Tuesday 13 October" or "Closed" on a campaign card.
 *
 * The campaigns page is built once and served for days, so a label decided
 * at build time said "Open now" on a campaign that had not opened, and kept
 * saying it after one had closed. The first paint is what the server built
 * (so hydration agrees); the browser then decides from its own clock, and
 * once more at the next boundary if the page is still open when it passes.
 */
export function CampaignPhasePill({
  campaign,
  initial,
  opensLabel,
}: {
  campaign: Campaign;
  initial: CampaignPhase;
  /** "Tuesday 13 October", formatted on the server in Lagos time. */
  opensLabel: string | null;
}) {
  const [phase, setPhase] = useState<CampaignPhase>(initial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      setPhase(campaignPhase(campaign, now));
      const next = [campaign.startsAt, campaign.endsAt]
        .map((iso) => (iso ? new Date(iso).getTime() + 1000 - now : -1))
        .filter((ms) => ms > 0)
        .sort((a, b) => a - b)[0];
      // setTimeout overflows past about 24.8 days; a day is plenty.
      if (next !== undefined) timer = setTimeout(tick, Math.min(next, 86_400_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [campaign]);

  if (phase === "open") {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
        Open now
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-line-2 px-3 py-1 text-xs font-semibold text-ink-3">
      {phase === "upcoming" ? (opensLabel ? `Opens ${opensLabel}` : "Opening soon") : "Closed"}
    </span>
  );
}
