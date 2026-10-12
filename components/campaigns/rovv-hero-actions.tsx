"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/shared/panel";
import { campaignPhase, type Campaign, type CampaignPhase } from "@/lib/campaigns";
import { ROVV, rovvRoutes } from "@/lib/rovv";

/**
 * The hero's buttons, which depend on the moment: "Enter now" while entries
 * can be sent, "See the winners" once they are listed, and, between the
 * close and the announcement, when the results come. Decided by the browser's
 * clock after the first paint, like CampaignPhasePill, because the page is
 * rebuilt only every few minutes and a button that sends people to a closed
 * form is the one thing here that must not be stale.
 */
export function RovvHeroActions({
  campaign,
  initial,
  winners,
}: {
  campaign: Campaign;
  initial: CampaignPhase;
  /** How many winners the page lists. */
  winners: number;
}) {
  const [phase, setPhase] = useState<CampaignPhase>(initial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      setPhase(campaignPhase(campaign, now));
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

  const rules = (
    <Link href={rovvRoutes.rules} className={buttonClass("secondary")}>
      Read the rules
    </Link>
  );

  if (phase === "closed") {
    return (
      <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
        {winners > 0 ? (
          <a href="#winners" className={buttonClass("primary")}>
            See the winners
          </a>
        ) : (
          <p className="text-base font-semibold text-white">Entries are closed. Winners by {ROVV.winnersByLabel}.</p>
        )}
        {rules}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
      <a href="#enter" className={buttonClass("primary")}>
        Enter now
      </a>
      {rules}
    </div>
  );
}
