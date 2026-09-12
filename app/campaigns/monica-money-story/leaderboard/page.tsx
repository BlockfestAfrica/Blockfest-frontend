import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { leaderboard } from "@/lib/leaderboard";
import {
  campaignBySlug,
  MONICA_FIRST_LEADERBOARD,
  monicaRoutes,
  MONICA_SLUG,
} from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";
import { LeaderboardTable } from "@/components/campaigns/leaderboard-table";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Who is leading ${CAMPAIGN.name}.`,
  alternates: { canonical: `${SITE_URL}${monicaRoutes.leaderboard}` },
};

/**
 * Rebuilt at most once a minute.
 *
 * The rules say the leaderboard updates every Saturday, which is about when the
 * standings are announced rather than how fresh this page is. A minute is short
 * enough that a creator who has just been approved sees themselves, and long
 * enough that the ranking query does not run once per visitor during a campaign
 * that is being shared.
 */
export const revalidate = 60;

export default async function MonicaLeaderboardPage() {
  const rows = await leaderboard(100);

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

          <p className="mt-6 eyebrow text-brand-gold">{CAMPAIGN.name}</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            Leaderboard
          </h1>

          {rows.length === 0 ? (
            <div className="mt-8 max-w-prose">
              <p className="text-base leading-relaxed text-white/60">
                Nothing to show yet. Points land when an entry is approved, and
                the first standings are published{" "}
                {MONICA_FIRST_LEADERBOARD}.
              </p>
              <Link
                href={monicaRoutes.register}
                className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
              >
                Join the campaign
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-white/50">
                Total points first. Level creators are separated by who reached
                that total first, then by approved entries.
              </p>

              <LeaderboardTable rows={rows} />
            </>
          )}

          <p className="mt-10 text-sm leading-relaxed text-white/45">
            Standings are announced {MONICA_FIRST_LEADERBOARD} and every
            Saturday after that. How points are earned is in the{" "}
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
