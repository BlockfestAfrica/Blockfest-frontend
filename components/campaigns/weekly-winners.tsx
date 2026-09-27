import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";
import { WINNER_CATEGORY_LABEL } from "@/lib/winner-categories";
import type { PublishedWinner } from "@/lib/winners";
import { Panel, Pill, SectionHeading } from "@/components/shared/panel";
import {
  monicaRoutes,
  MONICA_FIRST_LEADERBOARD,
  platformLabels,
  type CampaignPlatform,
} from "@/lib/campaigns";

const CATEGORY_LABEL: Record<string, string> = WINNER_CATEGORY_LABEL;

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

/**
 * The winners page's "Weekly winners" section: every announced week, newest
 * first, one card per award.
 *
 * A pure view of what the page already fetched, so it renders the same from
 * fixture props as from the database. The page owns the fetch and the
 * revalidate window; this owns nothing but the markup.
 */
export function WeeklyWinners({ winners }: { winners: PublishedWinner[] }) {
  const weeks = [...new Set(winners.map((w) => w.weekNo))].sort((a, b) => b - a);

  return (
    <section id="weekly" className="mt-12 scroll-mt-24">
      <SectionHeading
        label="Every Sunday"
        title="Weekly winners"
        hint="Creator of the Week, chosen by Blockfest Africa, lands here each Sunday. Community Favourite, decided by the public vote below, lands here once that vote closes."
      />
      {weeks.length === 0 ? (
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-3">
          Nothing announced yet. The first winners appear here on{" "}
          {MONICA_FIRST_LEADERBOARD}.{" "}
          <Link
            href={monicaRoutes.leaderboard}
            className="text-link underline underline-offset-2 hover:text-white"
          >
            The leaderboard
          </Link>{" "}
          moves as entries are approved.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {weeks.map((week) => (
            <section key={week}>
              <h2 className="text-xl font-bold text-white">Week {week}</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {winners
                  .filter((w) => w.weekNo === week)
                  .map((w) => (
                    <li key={`${w.weekNo}-${w.category}`}>
                      <Panel tone="quiet">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Trophy
                            className="h-5 w-5 shrink-0 text-brand-gold"
                            aria-hidden="true"
                          />
                          <p className="eyebrow text-brand-gold">
                            {CATEGORY_LABEL[w.category] ?? w.category}
                          </p>
                          <Pill tone="gold">{naira(w.prizeNaira)}</Pill>
                        </div>
                        <p className="mt-3 text-2xl font-bold text-white">
                          {w.name}
                        </p>
                        {w.note && (
                          <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-2">
                            {w.note}
                          </p>
                        )}
                        {w.links.length > 0 && (
                          <ul className="mt-4 flex flex-wrap gap-2">
                            {w.links.map((link) => (
                              <li key={link.url}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-3"
                                >
                                  {platformLabels[
                                    link.platform as CampaignPlatform
                                  ] ?? link.platform}
                                  <ExternalLink
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Panel>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
