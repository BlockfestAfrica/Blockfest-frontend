import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  monicaRules,
  monicaRulesOpenPoints,
  MONICA_RULES_UPDATED,
  MONICA_RULES_VERSION,
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
      <section className="section-y">
        <div className="container-page">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          <div className="mt-6 max-w-2xl">
            <h1 className="text-display-sm font-bold text-white">
              Campaign rules
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Version {MONICA_RULES_VERSION}, last updated {updated}. The
              version in force when you register is recorded against your entry.
            </p>
          </div>

          {monicaRulesOpenPoints.length > 0 && (
            <div className="mt-8 max-w-2xl rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
              <p className="text-sm font-semibold text-brand-gold">
                Still being finalised
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {monicaRulesOpenPoints.map((point) => (
                  <li
                    key={point}
                    className="text-sm leading-relaxed text-white/70"
                  >
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                These will be confirmed here before they affect anyone, and
                announced on the campaign page.
              </p>
            </div>
          )}

          {/* A contents list, because the clause somebody needs is usually one
              specific clause and this page is long. */}
          <nav aria-label="Rules contents" className="mt-12 max-w-2xl">
            <ol className="flex flex-wrap gap-x-5 gap-y-2">
              {monicaRules.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-link underline underline-offset-4 hover:text-white"
                  >
                    {i + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 flex max-w-2xl flex-col gap-10">
            {monicaRules.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24"
              >
                <h2 className="text-xl font-bold text-white">
                  <span className="tabular-nums text-white/40">{i + 1}. </span>
                  {section.title}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-base leading-relaxed text-white/60"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-14 max-w-2xl text-sm leading-relaxed text-white/50">
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
      </section>
    </main>
  );
}
