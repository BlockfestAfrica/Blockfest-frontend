import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";
import { ROVV, rovvRoutes } from "@/lib/rovv";
import { rovvPrivacyCollected, rovvPrivacySections, ROVV_PRIVACY_UPDATED } from "@/lib/rovv-privacy";
import { SITE_URL } from "@/lib/seo-event";

export const metadata: Metadata = {
  title: "ROVV Campaign Privacy Notice",
  description: `What personal data ${ROVV.title} collects, who sees it, and what you can ask for.`,
  alternates: { canonical: `${SITE_URL}${rovvRoutes.privacy}` },
};

/** The campaign privacy notice, in the same shape as Monica's. */
export default function RovvPrivacyPage() {
  const updated = new Date(ROVV_PRIVACY_UPDATED).toLocaleDateString("en-GB", {
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
            href={rovvRoutes.home}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {ROVV.title}
          </Link>

          <div className="mt-6 max-w-3xl">
            <p className="eyebrow text-brand-gold">{ROVV.title}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Campaign privacy notice
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Last updated {updated}. This covers {ROVV.title} specifically. The{" "}
              <Link href={rovvRoutes.rules} className="text-link underline underline-offset-2 hover:text-white">
                campaign rules
              </Link>{" "}
              cover everything else.
            </p>
          </div>

          <div className="mt-16 max-w-3xl">
            <section id="collected" className="scroll-mt-24">
              <h2 className="text-xl font-bold text-white">What we collect, and why</h2>
              <p className="mt-4 max-w-prose text-base leading-7 text-ink-2">
                Everything the entry form asks for, plus what is recorded automatically that you would not otherwise
                know about.
              </p>
              <ul className="mt-6 flex flex-col gap-4">
                {rovvPrivacyCollected.map((item) => (
                  <li key={item.what} className="rounded-xl border border-line-2 bg-card-2 p-4 sm:p-5">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
                      {item.what}
                      {item.automatic && (
                        <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-0.5 text-xs font-semibold text-brand-gold">
                          Recorded automatically
                        </span>
                      )}
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">{item.why}</p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-16 flex flex-col gap-12">
              {rovvPrivacySections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-xl font-bold text-white">{section.title}</h2>
                  <div className="mt-4 flex flex-col gap-4">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="max-w-prose text-base leading-[1.75] text-ink-2">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-16 text-sm leading-relaxed text-ink-4">
              Requests and questions go to{" "}
              <a href={`mailto:${PRIVACY_CONTACT}`} className="text-link underline underline-offset-2 hover:text-white">
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
