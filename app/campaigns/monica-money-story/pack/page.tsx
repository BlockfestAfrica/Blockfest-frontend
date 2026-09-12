import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import {
  monicaPackAllowed,
  monicaPackDisclosure,
  monicaPackOpenPoints,
  monicaPackPrinciple,
  monicaPackProhibited,
  monicaPackSections,
  MONICA_PACK_UPDATED,
  MONICA_PACK_VERSION,
} from "@/lib/monica-pack";
import { campaignBySlug, monicaRoutes, MONICA_SLUG } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Creator Pack",
  description: `What may and may not be said about Monica in an entry to ${CAMPAIGN.name}.`,
  // Indexed, like the rules. A creator searching for what they are allowed to
  // say should find this, and it is the document a rejected entry points back
  // to.
  alternates: { canonical: `${SITE_URL}${monicaRoutes.pack}` },
};

/**
 * The Creator Pack.
 *
 * The rules already make this document binding: they say it lists what may be
 * said about Monica and that entries breaching it will be rejected. Until now
 * the link from the campaign page resolved to a 404, which meant creators could
 * be rejected under a standard they had no way to read.
 *
 * So this publishes the half that does not depend on Monica, and names the half
 * that does rather than inventing it. Stating a fee or a transfer time for a
 * payments company we have not confirmed with would be the worst thing this
 * page could do, and is precisely the kind of claim it exists to prevent.
 *
 * Laid out as a document, like the rules, for the same reason: it is read
 * carefully rather than skimmed, sometimes by somebody whose entry has just
 * been rejected. The allowed and prohibited lists are the part most people came
 * for, so they sit near the top and are visually separated rather than being
 * two more prose sections.
 */
export default function MonicaPackPage() {
  const updated = new Date(MONICA_PACK_UPDATED).toLocaleDateString("en-GB", {
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
              Creator Pack
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Version {MONICA_PACK_VERSION}, last updated {updated}. The{" "}
              <Link
                href={monicaRoutes.rules}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign rules
              </Link>{" "}
              require entries to follow this pack.
            </p>
          </div>

          <div className="mt-12 max-w-2xl">
            {/* The one rule that answers most questions, given its own block so
                a creator who reads nothing else still leaves with it. */}
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 sm:p-6">
              <p className="eyebrow text-brand-gold">Start here</p>
              <p className="mt-3 max-w-prose text-base leading-7 text-white/80">
                {monicaPackPrinciple}
              </p>
            </div>

            {monicaPackOpenPoints.length > 0 && (
              <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6">
                <p className="text-sm font-semibold text-white">
                  Still coming from Monica
                </p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
                  These are not yet confirmed, so nothing in them may be stated
                  in an entry. They will be added here before they affect
                  anyone.
                </p>
                <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 marker:text-white/30">
                  {monicaPackOpenPoints.map((point) => (
                    <li
                      key={point}
                      className="text-sm leading-relaxed text-white/70"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* The two lists side by side on wide screens, because they are
                read against each other rather than in sequence. */}
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6">
                <h2 className="text-lg font-bold text-white">You may</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {monicaPackAllowed.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-green-400"
                        aria-hidden="true"
                      />
                      <span className="text-sm leading-relaxed text-white/75">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-5 sm:p-6">
                <h2 className="text-lg font-bold text-white">You may not</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {monicaPackProhibited.map((item) => (
                    <li key={item} className="flex gap-3">
                      <X
                        className="mt-1 h-4 w-4 shrink-0 text-red-400"
                        aria-hidden="true"
                      />
                      <span className="text-sm leading-relaxed text-white/75">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <section id="disclosure" className="mt-14 scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                Disclosing the partnership
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {monicaPackDisclosure.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="max-w-prose text-base leading-7 text-white/75"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {monicaPackDisclosure.labels.map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-14 flex flex-col gap-12">
              {monicaPackSections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-xl font-bold text-white">
                    {section.title}
                  </h2>
                  <div className="mt-4 flex flex-col gap-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="max-w-prose text-base leading-7 text-white/75"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-14 text-sm leading-relaxed text-white/50">
              Anything you are unsure about goes to{" "}
              <a
                href="mailto:partnership@blockfestafrica.com"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                partnership@blockfestafrica.com
              </a>
              . Ask before you publish.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
