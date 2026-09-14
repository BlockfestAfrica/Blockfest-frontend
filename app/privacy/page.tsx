import type { Metadata } from "next";
import Link from "next/link";
import {
  privacySections,
  privacySurfaces,
  PRIVACY_UPDATED,
  PRIVACY_VERSION,
} from "@/lib/privacy";
import { CONTACT_EMAIL } from "@/lib/constants";
import { monicaRoutes } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Blockfest Africa collects, who holds it, how long it is kept, and what you can ask for.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

/**
 * The site-wide privacy policy.
 *
 * The table is the point of this page. Most of what this site asks for is
 * handled by somebody else: the newsletter by Substack, tickets by Meetumo,
 * applications by Google Forms. A policy written as unbroken prose would let
 * that fact hide, and it is the fact that decides what somebody can actually
 * ask us to do. So each surface says what it takes and who ends up holding it,
 * and the ones we hold ourselves are marked.
 *
 * The badge generator is listed for the opposite reason. It takes a photograph
 * and never uploads it, which nobody would assume from using it.
 */
export default function PrivacyPage() {
  const updated = new Date(PRIVACY_UPDATED).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          <div className="max-w-2xl">
            <h1 className="text-display-sm font-bold text-white">
              Privacy policy
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Version {PRIVACY_VERSION}, last updated {updated}. Running a
              campaign has its own notice, which goes further: see the{" "}
              <Link
                href={monicaRoutes.privacy}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign privacy notice
              </Link>
              .
            </p>
          </div>

          <div className="mt-12 max-w-2xl">
            <section id="what" className="scroll-mt-24">
              <h2 className="text-xl font-bold text-white">
                What we ask for, and who holds it
              </h2>
              <p className="mt-4 max-w-prose text-base leading-7 text-ink-2">
                Every place on this site that asks you for something. Where a
                provider holds the record rather than us, it says so, because
                that decides who can act on a request.
              </p>

              <ul className="mt-6 flex flex-col gap-4">
                {privacySurfaces.map((surface) => (
                  <li
                    key={surface.name}
                    className="rounded-xl border border-line-2 bg-card-2 p-4 sm:p-5"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
                      {surface.name}
                      <span
                        className={
                          surface.heldByUs
                            ? "rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-0.5 text-xs font-semibold text-brand-gold"
                            : "rounded-full border border-line-2 bg-card-2 px-2.5 py-0.5 text-xs font-semibold text-ink-3"
                        }
                      >
                        {surface.heldByUs ? "We hold this" : "Held elsewhere"}
                      </span>
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                      {surface.collects}
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-4">
                      {surface.destination}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-14 flex flex-col gap-12">
              {privacySections.map((section) => (
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
                        className="max-w-prose text-base leading-7 text-ink-2"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-14 text-sm leading-relaxed text-ink-4">
              Requests and questions go to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
