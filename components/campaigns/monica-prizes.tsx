import Link from "next/link";
import {
  monicaFinalPrizes,
  monicaFinalTotal,
  monicaPointLadder,
  monicaRewardPool,
  monicaRoutes,
  monicaWeeklyPrizes,
  monicaWeeklyTotal,
} from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";

/**
 * Where the money goes.
 *
 * Every figure is read from lib/campaigns.ts rather than written into the
 * markup, so the totals here, the headline in the hero and the rules page
 * cannot disagree. A prize table that contradicts the rules is the kind of
 * thing a losing entrant screenshots.
 */
export function MonicaPrizes() {
  return (
    <section className="section-y border-t border-line-2 bg-ground">
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">
          {formatNaira(monicaRewardPool)}, and how it splits
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          Win a week, or win the whole thing.
        </p>

        {/* items-start: the weekly card has two rows against the final's
            five, and stretched equal it carried a void at the bottom. */}
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-line-2 bg-card-2 p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-bold text-white">Every week</h3>
              <p className="text-lg font-bold tabular-nums text-brand-gold">
                {formatNaira(monicaWeeklyTotal)}
              </p>
            </div>
            <dl className="mt-6 flex flex-col gap-5">
              {monicaWeeklyPrizes.map((prize) => (
                <div key={prize.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-base font-semibold text-white">
                      {prize.label}
                    </dt>
                    <dd className="tabular-nums text-ink-2">
                      {formatNaira(prize.amount)}
                      <span className="text-ink-4"> x{prize.count}</span>
                    </dd>
                  </div>
                  {prize.note && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-4">
                      {prize.note}
                    </p>
                  )}
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-line-2 bg-card-2 p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-bold text-white">
                Final leaderboard
              </h3>
              <p className="text-lg font-bold tabular-nums text-brand-gold">
                {formatNaira(monicaFinalTotal)}
              </p>
            </div>
            <dl className="mt-6 flex flex-col gap-4">
              {monicaFinalPrizes.map((prize) => (
                <div
                  key={prize.label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-base text-ink-2">{prize.label}</dt>
                  <dd className="font-semibold tabular-nums text-white">
                    {formatNaira(prize.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-line-2 p-6 sm:p-8">
          <h3 className="text-lg font-bold text-white">How points add up</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
            One approved entry earns 100. Put the same piece on another platform
            and it is still one entry, worth 50 more each time.
          </p>
          <ul className="mt-6 flex flex-wrap gap-4">
            {monicaPointLadder.map((tier) => (
              <li
                key={tier.platforms}
                className="flex-1 rounded-lg border border-line-2 bg-card-2 px-5 py-4 sm:flex-none sm:min-w-44"
              >
                <p className="text-2xl font-bold tabular-nums text-white">
                  {tier.points}
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {tier.platforms} platform{tier.platforms > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
          {/* The referral is the one bonus a creator can plan for, so it gets a
              number rather than being folded into "bonus points". */}
          <p className="mt-6 text-sm leading-relaxed text-ink-2">
            Bring in another creator with your referral link and you get 50
            points when their first entry is approved. There is no cap on how
            many you bring in.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            Other bonuses go to standout work, featured entries and
            collaborations. The full breakdown is in the{" "}
            <Link
              href={monicaRoutes.rules}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              campaign rules
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
