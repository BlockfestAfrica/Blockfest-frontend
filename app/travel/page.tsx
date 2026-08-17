import type { Metadata } from "next";
import Link from "next/link";
import {
  Bed,
  Bus,
  Mail,
  MapPin,
  Plane,
  Send,
} from "lucide-react";
import { CONTACT_EMAIL, SOCIAL_URLS } from "@/lib/constants";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";
import { TicketCTA } from "@/components/tickets/ticket-cta";

const EVENT = CURRENT_EDITION;

export const metadata: Metadata = {
  title: "Travel & Visa | Blockf3st Africa '26 Lagos",
  description: `Getting to ${EVENT.location.venue} for ${EVENT.date.displayDate}: invitation letters for visa applications, accommodation, moving around Lagos, and how to follow along if you cannot travel.`,
  keywords: [
    "blockfest africa travel",
    "blockfest lagos visa invitation letter",
    "nigeria conference visa letter",
    "lagos tech conference accommodation",
    "national art theatre lagos directions",
  ],
  openGraph: {
    title: "Travel & Visa | Blockf3st Africa '26 Lagos",
    description: `Everything you need to plan a trip to ${EVENT.location.venue} for ${EVENT.date.displayDate}.`,
  },
  alternates: { canonical: `${SITE_URL}/travel` },
};

/**
 * One page for everything a trip needs.
 *
 * All of this existed already, scattered across FAQ answers on a page almost
 * nobody opens, and some of it only inside a Telegram topic. Roughly a tenth of
 * traffic comes from outside Nigeria, and Nigeria needs a visa for most of
 * those countries, so "can I actually get there" is a question the site should
 * answer before someone buys.
 */
export default function TravelPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Travel & Visa",
            url: `${SITE_URL}/travel`,
            about: { "@id": EVENT_ID },
          }),
        }}
      />

      <main id="main">
        <section className="section-y bg-ground">
          <div className="container-page">
            <p className="eyebrow text-white/60">Plan your trip</p>
            <h1 className="text-display-sm mt-3 max-w-3xl font-bold text-white">
              Getting to Lagos
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              {EVENT.date.displayDate} at {EVENT.location.venue}.
            </p>
          </div>
        </section>

        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card icon={MapPin} title="The venue">
                <p>
                  {EVENT.location.venue}, {EVENT.location.country}. It sits on
                  Lagos Mainland beside the Iganmu interchange, a short drive
                  from Costain and around 30 minutes from Lagos Island outside
                  peak traffic.
                </p>
                <p>
                  <Link
                    href="/tickets#venue"
                    className="text-link underline underline-offset-2 hover:text-white"
                  >
                    Watch the venue walkthrough
                  </Link>{" "}
                  to see the room before you travel.
                </p>
              </Card>

              <Card icon={Plane} title="Visas and invitation letters">
                <p>
                  Most visitors need a visa to enter Nigeria. Apply early:
                  processing can take several weeks and a letter will not speed
                  up a late application.
                </p>
                {/* No document details asked for here. A public page is the
                    wrong place to tell people to send passport numbers, and
                    what an embassy wants varies, so this opens the
                    conversation rather than prescribing it. */}
                <p>
                  Whatever your application needs from us, email{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Visa and travel - Blockf3st Africa '26`}
                    className="text-link underline underline-offset-2 hover:text-white"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  and tell us what your embassy has asked for. Do not send
                  passport details until we reply and tell you where they
                  should go.
                </p>
              </Card>

              <Card icon={Bed} title="Where to stay">
                <p>
                  There are hotel and shortlet discounts for attendees
                  travelling in from outside Lagos. Deals and booking details
                  are posted in the accommodation topic of our Telegram
                  community.
                </p>
                <p>
                  <a
                    href={SOCIAL_URLS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-link underline underline-offset-2 hover:text-white"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Join the Telegram community
                  </a>
                </p>
              </Card>

              <Card icon={Bus} title="Moving around Lagos">
                <p>
                  Transport to the venue may be arranged within Lagos. At
                  checkout you are asked which area you are travelling from
                  (Ikeja, Surulere, Yaba, Ikorodu, Festac, Iyana Ipaja, Berger
                  or Ajah) so pickup points can be planned around where people
                  actually are.
                </p>
                <p>
                  Logistics updates go out in the Telegram community closer to
                  the event.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <div className="max-w-2xl">
              <h2 className="text-display-sm font-bold text-white">
                Still deciding?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                Tickets are transferable, so a pass bought now is not wasted if
                your plans change.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                <TicketCTA source="Travel Page - CTA" className="px-8">
                  Get your ticket
                </TicketCTA>
                <Link
                  href="/faq"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  Read the FAQ
                </Link>
              </div>
              {/* Same shape as the volunteer page: the sentence is a single
                  flex item so the address wraps as prose instead of being
                  squeezed into its own column. items-start because a wrapped
                  line should not push the icon to the vertical middle. */}
              <p className="mt-6 flex items-start gap-2 text-sm text-white/60">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Anything not answered here:{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="break-words text-link underline underline-offset-2 hover:text-white"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold text-white lg:text-2xl">{title}</h2>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-white/60 lg:text-base">
        {children}
      </div>
    </div>
  );
}
