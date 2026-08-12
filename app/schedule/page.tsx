import { Agenda } from "@/components/agenda";
import { gotham } from "@/lib/fonts";
import type { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";
import { ComingSoonNotice } from "@/components/shared/coming-soon-notice";

export const metadata: Metadata = {
  title: "Schedule | Blockfest Africa - Event Program & Activities",
  description:
    "The Lagos '26 three-day programme is published in the coming weeks. Meanwhile, see how the 2025 edition ran: keynotes, workshops, panels and networking.",
  keywords:
    "Blockfest Africa schedule, event program, blockchain conference schedule, tech conference activities, AI workshops",
  openGraph: {
    title: "Schedule | Blockfest Africa - Event Program & Activities",
    description:
      "The Lagos '26 three-day programme is published in the coming weeks. Meanwhile, see how the 2025 edition ran: keynotes, workshops, panels and networking.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Schedule | Blockfest Africa - Event Program & Activities",
    description:
      "The Lagos '26 three-day programme is published in the coming weeks. Meanwhile, see how the 2025 edition ran: keynotes, workshops, panels and networking.",
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
      "The Lagos '26 three-day programme is published in the coming weeks. Meanwhile, see how the 2025 edition ran: keynotes, workshops, panels and networking.",
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
      <main id="main" className={`${gotham.className} min-h-screen bg-paper`}>
        <ComingSoonNotice
          title="2026 schedule coming soon"
          description="The three-day Lagos '26 programme is published in the coming weeks. Below is the 2025 schedule for reference."
        />

        {/* Header Section */}
        <section className="section-y bg-ground">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow text-white/60">2025 SCHEDULE</p>
              <h1
                id="schedule-heading"
                className="text-display-sm mt-3 font-bold text-white"
              >
                Schedule of <span className="text-white">Activities</span>
              </h1>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                How the 2025 edition ran, hour by hour. The Lagos &apos;26
                programme spans three days and is published soon.
              </p>
            </div>
          </div>
        </section>

        <section className="section-y bg-paper">
          <div className="container-page">
            <Agenda />
          </div>
        </section>
      </main>
    </>
  );
}
