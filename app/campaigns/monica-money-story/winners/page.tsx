import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { currentShortlist, publishedWinners } from "@/lib/winners";
import { Panel, Pill, SectionHeading } from "@/components/shared/panel";
import {
  campaignBySlug,
  monicaRoutes,
  MONICA_FIRST_LEADERBOARD,
  MONICA_SLUG,
  platformLabels,
  type CampaignPlatform,
} from "@/lib/campaigns";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Winners",
  description: `Weekly winners and the Community Favourite shortlist for ${CAMPAIGN.name}.`,
};

/**
 * Rebuilt at most once a minute, like the leaderboard.
 *
 * Announcing is a deliberate act by an owner, so this does not need to be
 * instant, but it does need to be soon: a winner told they have been announced
 * should not have to explain why the page still says otherwise.
 */
export const revalidate = 60;

const CATEGORY_LABEL: Record<string, string> = {
  creator_of_week: "Creator of the Week",
  community_favourite: "Community Favourite",
};

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

export default async function WinnersPage() {
  const [winners, shortlist] = await Promise.all([
    publishedWinners(),
    currentShortlist(),
  ]);

  const weeks = [...new Set(winners.map((w) => w.weekNo))].sort((a, b) => b - a);

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-3xl">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          <p className="eyebrow mt-6 text-brand-gold">{CAMPAIGN.name}</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            Winners
          </h1>

          {weeks.length === 0 ? (
            <p className="mt-8 max-w-prose text-base leading-relaxed text-ink-3">
              Nothing announced yet. Weekly winners are announced on Sundays,
              starting {MONICA_FIRST_LEADERBOARD}.{" "}
              <Link
                href={monicaRoutes.leaderboard}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                The leaderboard
              </Link>{" "}
              moves as entries are approved.
            </p>
          ) : (
            <div className="mt-10 flex flex-col gap-10">
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
                                      rel="noopener noreferrer"
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

          {/*
           * The shortlist.
           *
           * One card per ENTRY, never per submission. A creator who published
           * the same piece on three platforms has one entry and three links,
           * and listing them three times would split their own vote against
           * themselves. Same grouping rule the leaderboard uses.
           */}
          {shortlist.length > 0 && (
            <div className="mt-16">
              <SectionHeading
                label="Open now"
                title="Community Favourite shortlist"
                hint="Voting runs as a poll on Monica's own channels, not here, so the vote reaches the audience it is meant to. The creator with the most valid votes wins."
              />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {shortlist.map((entry, index) => (
                  <li
                    key={`${entry.name}-${index}`}
                    className="rounded-xl border border-line bg-card p-5"
                  >
                    <p className="text-base font-semibold text-white">
                      {entry.name}
                    </p>
                    <p className="mt-1 text-sm text-ink-3">
                      Week {entry.weekNo}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {entry.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
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
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-14 max-w-prose text-sm leading-relaxed text-ink-3">
            Creator of the Week is selected by Blockfest Africa; Community
            Favourite is decided by public vote. How points are earned is in the{" "}
            <Link
              href={monicaRoutes.rules}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              campaign rules
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
