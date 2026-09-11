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
    <section className="section-y border-t border-white/20 bg-ground">
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">
          {formatNaira(monicaRewardPool)}, and how it splits
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Weekly prizes keep the campaign worth entering in week three. The
          final leaderboard rewards the whole run.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/20 bg-white/5 p-6 sm:p-8">
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
                    <dd className="tabular-nums text-white/80">
                      {formatNaira(prize.amount)}
                      <span className="text-white/50"> x{prize.count}</span>
                    </dd>
                  </div>
                  {prize.note && (
                    <p className="mt-1 text-sm leading-relaxed text-white/50">
                      {prize.note}
                    </p>
                  )}
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/5 p-6 sm:p-8">
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
                  <dt className="text-base text-white/80">{prize.label}</dt>
                  <dd className="font-semibold tabular-nums text-white">
                    {formatNaira(prize.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-white/20 p-6 sm:p-8">
          <h3 className="text-lg font-bold text-white">How points add up</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
            One approved entry earns 100. Publish the same piece on more than
            one platform and it stays a single entry, worth more.
          </p>
          <ul className="mt-6 flex flex-wrap gap-4">
            {monicaPointLadder.map((tier) => (
              <li
                key={tier.platforms}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-5 py-4 sm:flex-none sm:min-w-44"
              >
                <p className="text-2xl font-bold tabular-nums text-white">
                  {tier.points}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {tier.platforms} platform{tier.platforms > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-white/60">
            Bonus points go to standout work, featured entries, collaborations
            and creators you bring in. The full breakdown is in the{" "}
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
