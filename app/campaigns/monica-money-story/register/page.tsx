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
  title: "Join the challenge",
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
export default function MonicaRegisterPage() {
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
              Join the challenge
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              One form, once. You get your referral link straight away, and the
              first brief is waiting on the campaign page.
            </p>
          </div>

          <div className="mt-10">
            {CAMPAIGN.startsAt && OPENS_LABEL && (
              <RegistrationForm opensAt={CAMPAIGN.startsAt} />
            )}
          </div>

          <p className="mt-10 max-w-xl text-sm leading-relaxed text-white/50">
            We use your details to run the campaign: to contact you about
            entries, to verify that the accounts you publish from are yours, and
            to pay you if you win. Read the{" "}
            <Link
              href={monicaRoutes.rules}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              campaign rules
            </Link>{" "}
            for what that involves.
          </p>
        </div>
      </section>
    </main>
  );
}
