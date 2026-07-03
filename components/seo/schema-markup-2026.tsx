import React from "react";
import {
  blockfest2026SouthAfrica,
  blockfest2026Lagos,
  blockfest2025Lagos,
} from "@/lib/events";

interface BaseSchemaProps {
  type:
    | "Event"
    | "Organization"
    | "WebPage"
    | "FAQPage"
    | "AboutPage"
    | "ContactPage";
  data: Record<string, unknown>;
}

export function BaseSchema({ type, data }: BaseSchemaProps) {
  const baseContext = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(baseContext) }}
    />
  );
}

// Event Schema for Blockfest Africa 2026
export function EventSchema() {
  // Next event - Lagos 2026 (primary, upcoming)
  const lagosEvent = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Blockf3st Africa '26 - Lagos",
    description:
      "The Superbowl of Web3 returns to Lagos! New Trade Routes: Bringing Africa Onchain. Join Africa's biggest Web3 and AI festival, reaching 200M+ users of tomorrow.",
    startDate: blockfest2026Lagos.date.start,
    endDate: blockfest2026Lagos.date.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Lagos, Nigeria",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressRegion: "Lagos State",
        postalCode: "100001",
        addressCountry: "NG",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
      email: "partnerships@blockfestafrica.com",
      sameAs: [
        "https://twitter.com/blockfestafrica",
        "https://www.instagram.com/blockfestival_africa",
        "https://youtube.com/@blockchainfestivalafrica",
        "https://linkedin.com/company/blockfest-africa",
        "https://t.me/blockf3stafrica",
      ],
    },
    offers: {
      "@type": "Offer",
      url: "https://blockfestafrica.com",
      price: "0",
      priceCurrency: "NGN",
      availability: "https://schema.org/PreOrder",
      validFrom: "2026-01-01",
      description: "Tickets opening soon for Blockf3st Africa '26 - Lagos",
    },
    audience: {
      "@type": "Audience",
      audienceType:
        "Web3 builders, blockchain developers, AI engineers, crypto founders, DeFi enthusiasts, investors, government officials",
    },
    keywords:
      "blockchain, Web3, AI, DeFi, NFT, cryptocurrency, Africa, Lagos, Nigeria, conference, networking, technology, innovation",
    category: "Technology Conference",
    inLanguage: "en-US",
    typicalAgeRange: "18-65",
    image: "https://blockfestafrica.com/images/og-image.jpg",
  };

  // Past event - South Africa 2026 (Cape Town roadshow, completed)
  const southAfricaEvent = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Blockf3st Africa '26 - South Africa",
    description:
      "Blockf3st Africa's South African roadshow — a week of builder meetups, sessions and experiences across Cape Town that brought Africa's Web3 community together.",
    startDate: blockfest2026SouthAfrica.date.start,
    endDate: blockfest2026SouthAfrica.date.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Cape Town, South Africa",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Cape Town",
        addressRegion: "Western Cape",
        postalCode: "8000",
        addressCountry: "ZA",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
      email: "partnerships@blockfestafrica.com",
    },
    keywords:
      "blockchain, Web3, cryptocurrency, Africa, Cape Town, South Africa, roadshow, conference",
    category: "Technology Conference",
    inLanguage: "en-US",
    image: "https://blockfestafrica.com/images/og-image.jpg",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lagosEvent) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(southAfricaEvent) }}
      />
    </>
  );
}

// Organization Schema for Blockfest Africa
export function OrganizationSchema() {
  const stats = blockfest2025Lagos.stats;
  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Blockfest Africa",
    alternateName: ["Blockf3st Africa", "Blockfest"],
    url: "https://blockfestafrica.com",
    logo: "https://blockfestafrica.com/images/logo.png",
    description:
      "Africa's premier Web3 conference organizer. The Superbowl of Web3 - bringing together blockchain developers, crypto founders, government officials, and Web3 innovators to build the future of decentralized technology in Africa.",
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      name: "Lagos, Nigeria",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+234",
      contactType: "Partnership",
      email: "partnerships@blockfestafrica.com",
      availableLanguage: ["English"],
    },
    sameAs: [
      "https://twitter.com/blockfestafrica",
      "https://www.instagram.com/blockfestival_africa",
      "https://youtube.com/@blockchainfestivalafrica",
      "https://linkedin.com/company/blockfest-africa",
      "https://t.me/blockf3stafrica",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lagos",
      addressRegion: "Lagos State",
      addressCountry: "NG",
    },
    areaServed: [
      {
        "@type": "Place",
        name: "Africa",
      },
      {
        "@type": "Place",
        name: "South Africa",
      },
      {
        "@type": "Place",
        name: "Nigeria",
      },
    ],
    knowsAbout: [
      "Blockchain Technology",
      "Web3 Development",
      "DeFi",
      "NFTs",
      "Cryptocurrency",
      "Smart Contracts",
      "Decentralized Applications",
      "African Tech Ecosystem",
    ],
    // Achievements from 2025
    award: `2025 Achievement: ${stats?.totalRegistrations?.toLocaleString()}+ registrations, ${stats?.totalAttendees?.toLocaleString()}+ attendees from ${
      stats?.countriesRepresented
    }+ countries`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(orgData) }}
    />
  );
}

// Website Schema
export function WebsiteSchema() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Blockfest Africa",
    alternateName: "Blockf3st Africa 2026",
    url: "https://blockfestafrica.com",
    description:
      "Africa's premier Web3 conference - The Superbowl of Web3. After the South Africa roadshow, join us in Lagos (October 22–23, 2026). Connect with 200M+ potential web3 users.",
    publisher: {
      "@type": "Organization",
      name: "Blockfest Africa",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate:
          "https://blockfestafrica.com/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    mainEntity: [
      {
        "@type": "Event",
        name: "Blockf3st Africa '26 - Lagos",
        description: "The Superbowl of Web3 returns to Lagos, Nigeria",
        startDate: blockfest2026Lagos.date.start,
        location: {
          "@type": "Place",
          name: "Lagos, Nigeria",
        },
      },
      {
        "@type": "Event",
        name: "Blockf3st Africa '26 - South Africa",
        description: "The Superbowl of Web3 roadshow - Cape Town, South Africa",
        startDate: blockfest2026SouthAfrica.date.start,
        location: {
          "@type": "Place",
          name: "Cape Town, South Africa",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
    />
  );
}

// Breadcrumb Schema
interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
    />
  );
}

// 2025 Archive Event Schema
export function Event2025Schema() {
  const event = blockfest2025Lagos;
  const stats = event.stats!;

  const eventData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Blockfest Africa 2025",
    description: `${
      event.theme
    } - Africa's premier Web3 conference. ${stats.totalAttendees?.toLocaleString()}+ attendees, ${
      stats.speakers
    }+ speakers, ${stats.countriesRepresented}+ countries represented.`,
    startDate: event.date.start,
    endDate: event.date.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.location.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.location.city,
        addressCountry: event.location.countryCode,
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: stats.totalAttendees,
    },
    attendee: {
      "@type": "QuantitativeValue",
      value: stats.totalAttendees,
    },
    image: "https://blockfestafrica.com/images/og-image.jpg",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(eventData) }}
    />
  );
}
