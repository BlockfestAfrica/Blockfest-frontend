import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrackView } from "@/components/campaigns/track-view";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";
import { ROVV, rovvRoutes } from "@/lib/rovv";
import { rovvRules, rovvRulesOpenPoints, ROVV_RULES_UPDATED } from "@/lib/rovv-rules";
import { ROVV_EVENTS } from "@/lib/sabilytics";
import { SITE_URL } from "@/lib/seo-event";

export const metadata: Metadata = {
  title: "ROVV Campaign Rules",
  description: `The rules for ${ROVV.title}, the TikTok campaign from Blockfest Africa and ROVV.`,
  alternates: { canonical: `${SITE_URL}${rovvRoutes.rules}` },
};

/**
 * The campaign rules, laid out as Monica's are: one readable column, contents
 * at the top, each clause anchored so a decision can point at it, and
 * anything still being settled said plainly above the rest.
 */
export default function RovvRulesPage() {
  const updated = new Date(ROVV_RULES_UPDATED).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });

  return (
    <main id="main" className="bg-ground">
      <TrackView event={ROVV_EVENTS.rulesViewed} />
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
              Campaign rules
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Last updated {updated}. The rules in force when you enter are recorded with your entry.
            </p>
          </div>

          <div className="mt-12 max-w-3xl">
            {rovvRulesOpenPoints.length > 0 && (
              <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5 sm:p-6">
                <p className="text-sm font-semibold text-brand-gold">Still being finalised</p>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-ink-4">
                  {rovvRulesOpenPoints.map((point) => (
                    <li key={point} className="text-sm leading-relaxed text-ink-2">
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-ink-4">
                  These will be confirmed here before they affect anyone, and announced on the campaign page.
                </p>
              </div>
            )}

            <nav aria-label="Rules contents" className="mt-10 rounded-xl border-l-2 border-line-2 bg-card p-5 sm:p-6">
              <p className="eyebrow text-ink-4">Contents</p>
              <ol className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {rovvRules.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex min-h-11 items-center gap-2.5 text-sm leading-snug text-ink-2 transition-colors duration-200 hover:text-white"
                    >
                      <span className="tabular-nums text-ink-4">{i + 1}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-16 flex flex-col gap-12">
              {rovvRules.map((section, i) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="flex gap-4 text-xl font-bold text-white">
                    <span className="w-6 shrink-0 tabular-nums text-brand-gold/60">{i + 1}</span>
                    {section.title}
                  </h2>
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
              How your details are handled is set out in the{" "}
              <Link href={rovvRoutes.privacy} className="text-link underline underline-offset-2 hover:text-white">
                campaign privacy notice
              </Link>
              . Questions about these rules go to{" "}
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
