import React from "react";
import type { Metadata } from "next";
import { TicketHero } from "@/components/tickets/ticket-hero";
import { TicketAbout } from "@/components/tickets/ticket-about";
import { TicketTiers } from "@/components/tickets/ticket-tiers";
import { IdealAudience } from "@/components/tickets/ideal-audience";
import { TicketPolicy } from "@/components/tickets/ticket-policy";
import { EVENT_ID } from "@/lib/seo-event";
import {
  EARLY_BIRD_ENDS,
  TICKET_PLATFORM_URL,
  ticketTiers,
} from "@/lib/tickets";

export const metadata: Metadata = {
  title: "Tickets - Blockf3st Africa '26 Lagos | Early Bird Open",
  description:
    "Secure your seat for Blockf3st Africa '26 in Lagos, October 22–24, 2026. Ten passes from ₦7,500 across workshops, the conference day, The Back Room and VIP. Early bird ends August 30, 2026.",
  keywords: [
    "blockfest africa tickets",
    "blockfest 2026 tickets",
    "web3 conference tickets lagos",
    "blockchain conference tickets nigeria",
    "blockfest early bird",
    "buidl pass",
    "bridge pass",
    "become pass",
    "africa tech conference tickets",
  ],
  openGraph: {
    title: "Tickets - Blockf3st Africa '26 Lagos",
    description:
      "Three days of building, networking and dealmaking in Lagos. Early bird pricing ends August 30, 2026.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Blockf3st Africa '26 Tickets",
      },
    ],
  },
  twitter: {
    title: "Tickets - Blockf3st Africa '26 Lagos",
    description:
      "Three days of building, networking and dealmaking in Lagos. Early bird pricing ends August 30, 2026.",
    images: ["/images/twitter-image.jpg"],
  },
  alternates: {
    canonical: "https://blockfestafrica.com/tickets",
  },
};

/**
 * The Event itself is defined once in the root layout. This adds the itemised
 * per-tier offers to that same node by @id, so consumers merge them instead of
 * seeing two competing Event descriptions.
 */
function TicketOffersSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@id": EVENT_ID,
    offers: ticketTiers.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price,
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
      url: TICKET_PLATFORM_URL,
      ...(tier.standardPrice
        ? { priceValidUntil: EARLY_BIRD_ENDS.iso.slice(0, 10) }
        : {}),
    })),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

const TicketsPage = () => {
  return (
    <>
      <TicketOffersSchema />

      <main id="main">
        {/* Secure your seat — early bird countdown + primary CTA */}
        <TicketHero />

        {/* Overview and the buidl / bridge / become framing */}
        <TicketAbout />

        {/* The ten passes, grouped by which days they cover */}
        <TicketTiers />

        {/* Who the room is built for */}
        <IdealAudience />

        {/* Refund and transfer policy + closing CTA */}
        <TicketPolicy />
      </main>
    </>
  );
};

export default TicketsPage;
