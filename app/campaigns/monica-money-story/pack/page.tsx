import { LiveResources } from "@/components/campaigns/live-resources";
import { TrackView } from "@/components/campaigns/track-view";
import { CAMPAIGN_EVENTS } from "@/lib/sabilytics";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import {
  monicaPackAllowed,
  MONICA_BRAND_ASSETS_URL,
  monicaChannels,
  monicaPackDisclosure,
  monicaPackFacts,
  monicaPackOpenPoints,
  monicaPackPrinciple,
  monicaPackProhibited,
  monicaPackSections,
  MONICA_PACK_UPDATED,
  MONICA_PACK_VERSION,
  MONICA_SOURCE_DATE,
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
 * The product facts come from Monica's own published terms, so most of what a
 * creator wants to say now has an approved form rather than a prohibition. The
 * wording carries the weight: Monica says it is aligned with the SEC's VASP
 * framework and never licensed or regulated by it, it converts one way and is
 * not a custodian, and nothing about it is insured. Each of those is a
 * distinction somebody would collapse in good faith, and each collapse is a
 * false statement about a financial business.
 *
 * What Monica's documents do not answer stays in the open list rather than
 * being filled in with something plausible.
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
  <TrackView event={CAMPAIGN_EVENTS.packViewed} />
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
            <p className="eyebrow text-brand-gold">{CAMPAIGN.name}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
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

            {/* The confirmed facts, before the two lists.
                Most of what a creator wants to say is a fact about the product,
                so giving them the approved form of each one is more useful than
                a longer list of things not to do. The wording is the point:
                several of these are correct only as written. */}
            <section id="facts" className="mt-14 scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                Confirmed facts you may state
              </h2>
              <p className="mt-4 max-w-prose text-base leading-7 text-white/75">
                Taken from Monica&apos;s own published terms, dated{" "}
                {MONICA_SOURCE_DATE}. Say these as they are written here.
                Several are accurate only in this exact form.
              </p>

              <dl className="mt-6 flex flex-col gap-4">
                {monicaPackFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5"
                  >
                    <dt className="text-base font-semibold text-white">
                      {fact.label}
                    </dt>
                    <dd className="mt-2 max-w-prose text-sm leading-relaxed text-white/70">
                      {fact.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* The two lists side by side on wide screens, because they are
                read against each other rather than in sequence. */}
            <div className="mt-14 grid gap-6 lg:grid-cols-2">
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
                    className="max-w-prose text-base leading-[1.75] text-white/75"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <p className="mt-5 text-sm leading-relaxed text-white/70">
                Tag {monicaPackDisclosure.tag}
              </p>

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
                        className="max-w-prose text-base leading-[1.75] text-white/75"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section id="assets" className="mt-14 scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                Logo and brand assets
              </h2>
              <p className="mt-2 max-w-prose text-base leading-7 text-white/75">
                Monica&apos;s own folder. Linked rather than copied here, so you
                always get the current files rather than whatever was correct
                when this page was written.
              </p>
              <a
                href={MONICA_BRAND_ASSETS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-brand-gold/50 bg-brand-gold/10 px-6 text-sm font-semibold text-brand-gold transition-colors duration-300 hover:bg-brand-gold/20"
              >
                Open Monica&apos;s brand assets
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 text-sm leading-relaxed text-white/45">
                Open to anyone with the link, so no Google account and no
                request needed. If that ever changes, tell us at
                partnership@blockfestafrica.com rather than waiting: chasing it
                is ours to do, not yours.
              </p>
            </section>

            <section id="channels" className="mt-14 scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                Monica&apos;s accounts
              </h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/55">
                The real ones. A near-miss handle tags somebody else entirely.
              </p>
              <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-xl bg-white/10">
                {monicaChannels.map((channel) => (
                  <li
                    key={channel.label}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-ground px-4 py-3"
                  >
                    <span className="w-24 shrink-0 text-sm text-white/45">
                      {channel.label}
                    </span>
                    <span className="font-mono text-sm text-brand-gold">
                      {channel.handle}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <LiveResources />

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
