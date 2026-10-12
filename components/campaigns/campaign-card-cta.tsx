"use client";

import { useEffect, useState } from "react";
import { campaignPhase, type Campaign } from "@/lib/campaigns";

/**
 * The words on a campaign card's button, by the browser's clock: "Enter the
 * campaign" while it takes entries, "See the campaign" before and after.
 * The campaigns page is built once, so a label decided then invited people
 * to enter a campaign that had closed.
 */
export function CampaignCardCta({ campaign, initial }: { campaign: Campaign; initial: string }) {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      setLabel(campaignPhase(campaign, now) === "open" ? "Enter the campaign" : "See the campaign");
      // Once more just past the next boundary, for a page left open across it.
      const next = [campaign.startsAt, campaign.endsAt]
        .map((iso) => (iso ? new Date(iso).getTime() + 1000 - now : -1))
        .filter((ms) => ms > 0)
        .sort((a, b) => a - b)[0];
      if (next !== undefined) timer = setTimeout(tick, Math.min(next, 86_400_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [campaign]);
  return <>{label}</>;
}
