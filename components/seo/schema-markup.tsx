import React from "react";

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

// Event Schema for Blockfest Africa
export function EventSchema() {
  const eventData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Blockfest Africa 2025",
    description:
      "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators for a day of learning, networking, and building the future of decentralized technology in Africa.",
    startDate: "2025-10-11T08:00:00+01:00",
    endDate: "2025-10-11T18:00:00+01:00",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Landmark Event Center",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Landmark Event Center",
        addressLocality: "Lagos",
        addressRegion: "Lagos State",
        postalCode: "101001",
        addressCountry: "NG",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "6.4474",
        longitude: "3.4126",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
      email: "partnership@blockfestafrica.com",
      sameAs: [
        "https://twitter.com/blockfestafrica",
        "https://instagram.com/blockfestafrica",
        "https://youtube.com/@blockfestafrica",
        "https://linkedin.com/company/blockfest-africa",
        "https://t.me/blockf3stafrica",
      ],
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
      url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
      description: "Free admission to Blockfest Africa 2025",
    },
    performer: [
      {
        "@type": "Organization",
        name: "Blockfest Africa",
        description:
          "Leading Web3 and blockchain conference organizer in Africa",
      },
    ],
    audience: {
      "@type": "Audience",
      audienceType:
        "Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors",
    },
    keywords:
      "blockchain, Web3, DeFi, NFT, cryptocurrency, Africa, Lagos, conference, networking, technology, innovation",
    category: "Technology Conference",
    inLanguage: "en-US",
    isAccessibleForFree: true,
    typicalAgeRange: "18-65",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(eventData) }}
    />
  );
}

// Organization Schema for Blockfest Africa
export function OrganizationSchema() {
  const orgData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Blockfest Africa",
    alternateName: "Blockfest",
    url: "https://blockfestafrica.com",
    logo: "https://blockfestafrica.com/images/logo.png",
    description:
      "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, and Web3 innovators to build the future of decentralized technology in Africa.",
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      name: "Lagos, Nigeria",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+234",
      contactType: "Partnership",
      email: "partnership@blockfestafrica.com",
      availableLanguage: ["English"],
    },
    sameAs: [
      "https://twitter.com/blockfestafrica",
      "https://instagram.com/blockfestafrica",
      "https://youtube.com/@blockfestafrica",
      "https://linkedin.com/company/blockfest-africa",
      "https://t.me/blockf3stafrica",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lagos",
      addressRegion: "Lagos State",
      addressCountry: "NG",
    },
    areaServed: {
      "@type": "Place",
      name: "Africa",
    },
    knowsAbout: [
      "Blockchain Technology",
      "Web3 Development",
      "DeFi",
      "NFTs",
      "Cryptocurrency",
      "Smart Contracts",
      "Decentralized Applications",
    ],
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
    alternateName: "Blockfest Africa 2025",
    url: "https://blockfestafrica.com",
    description:
      "Africa's premier Web3 conference website featuring event information, speakers, schedule, and registration for blockchain and cryptocurrency enthusiasts.",
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
    mainEntity: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators for a day of learning, networking, and building the future of decentralized technology in Africa.",
      startDate: "2025-10-11T08:00:00+01:00",
      endDate: "2025-10-11T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: "Landmark Event Center",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Landmark Event Center",
          addressLocality: "Lagos",
          addressRegion: "Lagos State",
          postalCode: "101001",
          addressCountry: "NG",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: "6.4474",
          longitude: "3.4126",
        },
      },
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
        email: "partnership@blockfestafrica.com",
        sameAs: [
          "https://twitter.com/blockfestafrica",
          "https://instagram.com/blockfestafrica",
          "https://youtube.com/@blockfestafrica",
          "https://linkedin.com/company/blockfest-africa",
          "https://t.me/blockf3stafrica",
        ],
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "NGN",
        availability: "https://schema.org/InStock",
        url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
        description: "Free admission to Blockfest Africa 2025",
      },
      performer: [
        {
          "@type": "Organization",
          name: "Blockfest Africa",
          description:
            "Leading Web3 and blockchain conference organizer in Africa",
        },
      ],
      image: "https://blockfestafrica.com/images/og-image.jpg",
    },
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
