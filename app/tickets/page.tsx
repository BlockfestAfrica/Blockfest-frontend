import React from "react";
import type { Metadata } from "next";
import { TicketHero } from "@/components/tickets/ticket-hero";
import { TicketAbout } from "@/components/tickets/ticket-about";
import { TicketTiers } from "@/components/tickets/ticket-tiers";
import { IdealAudience } from "@/components/tickets/ideal-audience";
import { TicketPolicy } from "@/components/tickets/ticket-policy";
import { blockfest2026Lagos } from "@/lib/events";
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

/** Event schema carrying one Offer per ticket tier. */
function TicketOffersSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: blockfest2026Lagos.name,
    description:
      "BlockFest Africa 2026 is Africa's leading convention and festival of frontiers across AI, Web3, venture capital, investment, technology, culture and careers.",
    startDate: blockfest2026Lagos.date.start,
    endDate: blockfest2026Lagos.date.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "National Art Theatre, Lagos",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressRegion: "Lagos State",
        addressCountry: "NG",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
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

      <main>
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
