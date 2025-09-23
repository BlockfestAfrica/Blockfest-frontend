import React from "react";

export function AnalyticsSchema() {
  const analyticsData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Blockfest Africa 2025 - Analytics Dashboard",
    description:
      "Real-time analytics and insights for Blockfest Africa 2025 registrations, demographics, and event statistics.",
    url: "https://blockfestafrica.com/analytics",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators.",
      startDate: "2025-10-11T08:00:00+01:00",
      endDate: "2025-10-11T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
      },
    },
    mainEntity: {
      "@type": "Dataset",
      name: "Blockfest Africa 2025 Event Analytics",
      description:
        "Registration statistics, demographic insights, and event metrics for Blockfest Africa 2025",
      creator: {
        "@type": "Organization",
        name: "Blockfest Africa",
      },
      keywords:
        "event analytics, registration statistics, demographics, Web3 conference data",
      temporalCoverage: "2025",
      spatialCoverage: "Nigeria, Africa",
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://blockfestafrica.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Analytics",
          item: "https://blockfestafrica.com/analytics",
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(analyticsData) }}
    />
  );
}

export function InsightsSchema() {
  const insightsData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Blockfest Africa 2025 - Event Insights",
    description:
      "Comprehensive insights and data analysis for Blockfest Africa 2025 including attendee demographics, registration trends, and event statistics.",
    url: "https://blockfestafrica.com/insights",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators.",
      startDate: "2025-10-11T08:00:00+01:00",
      endDate: "2025-10-11T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
      },
    },
    mainEntity: {
      "@type": "AnalysisNewsArticle",
      headline: "Blockfest Africa 2025 Event Insights and Analytics",
      description:
        "Deep dive into the data behind Africa's premier Web3 conference",
      author: {
        "@type": "Organization",
        name: "Blockfest Africa",
      },
      publisher: {
        "@type": "Organization",
        name: "Blockfest Africa",
      },
      datePublished: "2025-09-22",
      dateModified: "2025-09-22",
      articleSection: "Event Analytics",
      keywords:
        "Web3 analytics, blockchain conference insights, African tech demographics",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(insightsData) }}
    />
  );
}
