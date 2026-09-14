import { TrackView } from "@/components/campaigns/track-view";
import { CAMPAIGN_EVENTS } from "@/lib/sabilytics";
import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  monicaRules,
  monicaRulesOpenPoints,
  MONICA_RULES_UPDATED,
} from "@/lib/monica-rules";
import { campaignBySlug, monicaRoutes, MONICA_SLUG } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Campaign Rules",
  description: `The rules for ${CAMPAIGN.name}, the creator campaign from Blockfest Africa.`,
  // Worth indexing: a creator searching for the terms should find them, and it
  // is the page every dispute points back to.
  alternates: { canonical: `${SITE_URL}${monicaRoutes.rules}` },
};

/**
 * The campaign rules.
 *
 * Interim wording, published early on purpose. Several of these terms are
 * unenforceable unless they were in front of a creator before they entered:
 * you cannot tell somebody in week three that bought engagement was
 * disqualifying, or ask a winner for identity documents nobody mentioned, or
 * repost their work under a licence they were never offered.
 *
 * Laid out as a document rather than a marketing page, because that is what it
 * is and it is read differently: one column at a comfortable measure, contents
 * in a block at the top, and a body set at higher contrast and a longer line
 * height than the rest of the site uses. Everywhere else the reader is
 * skimming; here they are reading every word, possibly while annoyed.
 *
 * A sticky sidebar would suit a document this long and is deliberately not
 * used. globals.css sets overflow-x: hidden on html and body, which makes them
 * scroll containers and breaks position: sticky against the viewport anywhere
 * on the site. Switching that to overflow-x: clip would fix it in one word, but
 * that rule is there to stop horizontal scroll somewhere and changing it
 * globally to buy a sidebar on one page is not a trade worth making days before
 * a launch.
 *
 * Each clause carries an id so it can be linked to directly, which is what you
 * want the moment a decision is questioned.
 */
export default function MonicaRulesPage() {
  const updated = new Date(MONICA_RULES_UPDATED).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });

  return (
    <main id="main" className="bg-ground">
  <TrackView event={CAMPAIGN_EVENTS.rulesViewed} />
      <section className="section-y">
        <div className="container-page">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          <div className="mt-6 max-w-3xl">
            <p className="eyebrow text-brand-gold">{CAMPAIGN.name}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Campaign rules
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Last updated {updated}. The rules in force when you register are
              recorded against your entry.
            </p>
          </div>

          <div className="mt-16 max-w-3xl">
            {monicaRulesOpenPoints.length > 0 && (
              <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 sm:p-6">
                <p className="text-sm font-semibold text-brand-gold">
                  Still being finalised
                </p>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-ink-4">
                  {monicaRulesOpenPoints.map((point) => (
                    <li
                      key={point}
                      className="text-sm leading-relaxed text-ink-2"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-ink-4">
                  These will be confirmed here before they affect anyone, and
                  announced on the campaign page.
                </p>
              </div>
            )}

            {/* Two columns so twelve items read as a tidy block rather than
                the ragged wrapped line of underlined links this was. */}
            <nav
              aria-label="Rules contents"
              className="mt-10 rounded-xl border-l-2 border-line-2 bg-card p-5 pl-5 sm:p-6 sm:pl-6"
            >
              <p className="eyebrow text-ink-4">Contents</p>
              <ol className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {monicaRules.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2.5 text-sm leading-snug text-ink-2 transition-colors duration-200 hover:text-white"
                    >
                      <span className="tabular-nums text-ink-4">
                        {i + 1}
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-16 flex flex-col gap-12">
              {monicaRules.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <h2 className="flex gap-4 text-xl font-bold text-white">
                    <span className="w-6 shrink-0 tabular-nums text-brand-gold/60">
                      {i + 1}
                    </span>
                    {section.title}
                  </h2>
                  <div className="mt-4 flex flex-col gap-4">
                    {section.paragraphs.map((paragraph, pIndex) => (
                      <Fragment key={paragraph}>
                        <p
                          className="max-w-prose text-base leading-[1.75] text-ink-2"
                        >
                          {paragraph}
                        </p>
                        {/* The table sits after the first paragraph, so the
                            sentence introducing the numbers stays above them. */}
                        {pIndex === 0 && section.table && (
                          <div className="max-w-prose overflow-x-auto rounded-lg border border-line">
                            <table className="w-full min-w-[20rem] border-collapse text-left">
                              <thead>
                                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-3">
                                  <th className="px-4 py-3">
                                    {section.table.head[0]}
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    {section.table.head[1]}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.table.rows.map(([what, points]) => (
                                  <tr
                                    key={what}
                                    className="border-b border-line last:border-0"
                                  >
                                    <td className="px-4 py-3 text-sm leading-relaxed text-ink-2">
                                      {what}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-white">
                                      {points}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-16 text-sm leading-relaxed text-ink-4">
              How your details are handled is set out in the{" "}
              <Link
                href={monicaRoutes.privacy}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign privacy notice
              </Link>
              , and what you may say about Monica in an entry is in the{" "}
              <Link
                href={monicaRoutes.pack}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Creator Pack
              </Link>
              .
            </p>

            <p className="mt-4 text-sm leading-relaxed text-ink-4">
              Questions about these rules go to{" "}
              <a
                href="mailto:partnership@blockfestafrica.com"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                partnership@blockfestafrica.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
