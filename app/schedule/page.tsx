import { Agenda } from "@/components/agenda";
import { gotham } from "@/lib/fonts";
import type { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";

export const metadata: Metadata = {
  title: "Schedule | Blockfest Africa - Event Program & Activities",
  description:
    "Explore the full schedule of activities for Blockfest Africa. Join industry leaders, attend keynote sessions, and participate in workshops on AI, Blockchain, and emerging technologies.",
  keywords:
    "Blockfest Africa schedule, event program, blockchain conference schedule, tech conference activities, AI workshops",
  openGraph: {
    title: "Schedule | Blockfest Africa - Event Program & Activities",
    description:
      "Explore the full schedule of activities for Blockfest Africa. Join industry leaders, attend keynote sessions, and participate in workshops on AI, Blockchain, and emerging technologies.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Schedule | Blockfest Africa - Event Program & Activities",
    description:
      "Explore the full schedule of activities for Blockfest Africa. Join industry leaders, attend keynote sessions, and participate in workshops on AI, Blockchain, and emerging technologies.",
  },
  alternates: {
    canonical: "https://blockfestafrica.com/schedule",
  },
};

export default function Schedule() {
  // Structured data for better SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Blockfest Africa 2025",
    description:
      "Premier blockchain and technology conference in Africa bringing together builders, founders, investors, and DeFi professionals.",
    startDate: "2025-10-11T08:00:00+01:00",
    endDate: "2025-10-11T17:30:00+01:00",
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
    image: "https://blockfestafrica.com/images/og-image.jpg",
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
      email: "partnership@blockfestafrica.com",
      sameAs: [
        "https://twitter.com/blockfestafrica",
        "https://www.instagram.com/blockfestival_africa?igsh=NG1ma2p1aXV2OHk2&utm_source=qr",
        "https://youtube.com/@blockchainfestivalafrica?si=UhSMNPr7GIfOzZk9",
        "https://linkedin.com/company/blockfest-africa",
        "https://t.me/blockf3stafrica",
      ],
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
    },
    performer: [
      {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
      },
    ],
  };

  const schedulePageData = {
    name: "Schedule - Blockfest Africa 2025",
    description:
      "Explore the full schedule of activities for Blockfest Africa. Join industry leaders, attend keynote sessions, and participate in workshops on AI, Blockchain, and emerging technologies.",
    url: "https://blockfestafrica.com/schedule",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      description:
        "Premier blockchain and technology conference in Africa bringing together builders, founders, investors, and DeFi professionals.",
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
          "https://www.instagram.com/blockfestival_africa?igsh=NG1ma2p1aXV2OHk2&utm_source=qr",
          "https://youtube.com/@blockchainfestivalafrica?si=UhSMNPr7GIfOzZk9",
          "https://linkedin.com/company/blockfest-africa",
          "https://t.me/blockf3stafrica",
        ],
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
      },
      performer: [
        {
          "@type": "Organization",
          name: "Blockfest Africa",
          url: "https://blockfestafrica.com",
        },
      ],
    },
    mainEntity: {
      "@type": "EventSchedule",
      name: "Blockfest Africa 2025 Schedule",
      description: "Complete program of activities for Blockfest Africa 2025",
    },
  };

  return (
    <>
      <BaseSchema type="WebPage" data={schedulePageData} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className={`${gotham.className} min-h-screen bg-white`}>
        {/* Header Section */}
        <div className="bg-gradient-to-br from-brand-blue via-brand-blue-dark to-brand-blue-deep py-12 lg:py-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4 border border-white/10">
              <span className="text-white font-semibold text-sm">
                2025 SCHEDULE
              </span>
            </div>
            <h1 className="font-bold text-3xl lg:text-5xl mb-4 text-white">
              Schedule of <span className="text-white">Activities</span>
            </h1>
            <p className="text-base lg:text-lg text-white/80 max-w-2xl mx-auto">
              Join us for an exciting day filled with insights from industry
              leaders, innovative workshops, and networking opportunities.
            </p>
          </div>
        </div>

        <section className="py-12 lg:py-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-8">
            <Agenda />
          </div>
        </section>
      </main>
    </>
  );
}
