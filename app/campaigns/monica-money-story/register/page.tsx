import { cookies } from "next/headers";
import { REFERRAL_COOKIE } from "@/lib/campaign-registration";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegistrationForm } from "@/components/campaigns/registration-form";
import {
  campaignBySlug,
  campaignOpensLabel,
  monicaRoutes,
  MONICA_SLUG,
} from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;
const OPENS_LABEL = campaignOpensLabel(CAMPAIGN);

export const metadata: Metadata = {
  title: "Register for the campaign",
  description: `Register for ${CAMPAIGN.name}, the creator campaign from Blockfest Africa.`,
  // Not indexed. The campaign page is what should rank and what carries the
  // explanation; a form on its own in a search result is a worse answer to
  // every query that could return it.
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE_URL}${monicaRoutes.landing}` },
};

/**
 * Registration.
 *
 * The page is prerendered and the form decides for itself whether the campaign
 * has opened, resolving the date after mount. That keeps this static like the
 * rest of the campaign, and means a page built before launch does not have "not
 * open yet" frozen into it.
 */
export default async function MonicaRegisterPage() {
  /*
   * Read here rather than in the browser.
   *
   * /join sets this cookie httpOnly, so document.cookie cannot see it. The
   * client can only know somebody arrived through a referral if the server
   * tells it.
   */
  const arrivedViaReferral =
    (await cookies()).get(REFERRAL_COOKIE)?.value !== undefined;

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
            <p className="eyebrow text-brand-gold">{CAMPAIGN.name}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Join the campaign
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-white/55">
              One form, once. A new brief every Monday.
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              {CAMPAIGN.startsAt && OPENS_LABEL && (
                <RegistrationForm
                  opensAt={CAMPAIGN.startsAt}
                  arrivedViaReferral={arrivedViaReferral}
                />
              )}
            </div>

            {/* What happens next, beside the form rather than after it. The
                distinction between registering once and submitting an entry
                each week is the thing creators get wrong, and it is worth
                answering where they are deciding rather than in the rules. */}
            <aside className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 p-6 sm:p-8">
                <h2 className="text-lg font-bold text-white">
                  What happens after this
                </h2>
                <ol className="mt-6 flex flex-col gap-6">
                  {[
                    {
                      title: "You get your referral link",
                      detail:
                        "Straight away, on this page. Share it to bring other creators in.",
                    },
                    {
                      title: "A brief drops every Monday",
                      detail:
                        "One per week. You do not register again for any of them.",
                    },
                    {
                      title: "You publish, then submit the link",
                      detail:
                        "Post on your own account, then come back and paste the URL. Post the same piece on all three platforms and it still counts as one entry, worth more points.",
                    },
                    {
                      title: "We review, and points land",
                      detail:
                        "The leaderboard moves as entries are approved. Weekly winners are announced on Sundays.",
                    },
                  ].map((step, i) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-bold tabular-nums text-brand-gold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-base font-semibold text-white">
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="mt-6 text-sm leading-relaxed text-white/50">
                We use your details to run the campaign: to contact you about
                entries, to check the accounts you publish from are yours, and
                to pay you if you win. The{" "}
                <Link
                  href={monicaRoutes.rules}
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  campaign rules
                </Link>{" "}
                set out what that involves.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
