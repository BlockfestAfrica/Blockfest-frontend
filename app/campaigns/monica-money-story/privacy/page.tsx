import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  monicaPrivacyCollected,
  monicaPrivacySections,
  MONICA_PRIVACY_UPDATED,
  MONICA_PRIVACY_VERSION,
  PRIVACY_CONTACT,
} from "@/lib/monica-privacy";
import { campaignBySlug, monicaRoutes, MONICA_SLUG } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Campaign Privacy Notice",
  description: `What personal data ${CAMPAIGN.name} collects, why, and what you can ask for.`,
  // Indexed. Somebody looking for what a site does with their phone number
  // should be able to find it without registering first.
  alternates: { canonical: `${SITE_URL}${monicaRoutes.privacy}` },
};

/**
 * The campaign privacy notice.
 *
 * The form asks for a name, an email address, a phone number, three handles, a
 * niche, an audience size and a location, and the endpoint records the IP
 * address and user agent on top of that. Until this page existed, nothing on
 * the site said so, which the NDPA requires at the point of collection rather
 * than later on request.
 *
 * The collected table is the part that matters most and is deliberately a
 * table. Prose lets a notice be technically complete while remaining unreadable
 * in practice, and the two automatically captured items are the ones a reader
 * would most reasonably expect to be hidden in a paragraph. They are flagged
 * instead.
 */
export default function MonicaPrivacyPage() {
  const updated = new Date(MONICA_PRIVACY_UPDATED).toLocaleDateString("en-GB", {
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

          <div className="mt-6 max-w-3xl">
            <p className="eyebrow text-brand-gold">{CAMPAIGN.name}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Campaign privacy notice
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Version {MONICA_PRIVACY_VERSION}, last updated {updated}. This
              covers {CAMPAIGN.name} specifically. The{" "}
              <Link
                href={monicaRoutes.rules}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign rules
              </Link>{" "}
              cover everything else.
            </p>
          </div>

          <div className="mt-16 max-w-3xl">
            <section id="collected" className="scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                What we collect, and why
              </h2>
              <p className="mt-4 max-w-prose text-base leading-7 text-ink-2">
                Everything the registration form asks for, plus the three things
                recorded automatically that you would not otherwise know about.
              </p>

              <ul className="mt-6 flex flex-col gap-4">
                {monicaPrivacyCollected.map((item) => (
                  <li
                    key={item.what}
                    className="rounded-xl border border-line-2 bg-card-2 p-4 sm:p-5"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
                      {item.what}
                      {item.automatic && (
                        <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-0.5 text-xs font-semibold text-brand-gold">
                          Recorded automatically
                        </span>
                      )}
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
                      {item.why}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-16 flex flex-col gap-12">
              {monicaPrivacySections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <h2 className="text-xl font-bold text-white">
                    {section.title}
                  </h2>
                  <div className="mt-4 flex flex-col gap-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="max-w-prose text-base leading-[1.75] text-ink-2"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-16 text-sm leading-relaxed text-ink-4">
              Requests and questions go to{" "}
              <a
                href={`mailto:${PRIVACY_CONTACT}`}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                {PRIVACY_CONTACT}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
