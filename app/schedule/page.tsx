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
        "https://instagram.com/blockfestafrica",
        "https://youtube.com/@blockfestafrica",
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
          "https://instagram.com/blockfestafrica",
          "https://youtube.com/@blockfestafrica",
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
        <section className="flex flex-col items-center justify-center pt-4 sm:pt-6 lg:pt-8 pb-12 sm:pb-16 lg:pb-20 lg:px-[100px] md:px-[60px] px-4 sm:px-8 max-w-7xl mx-auto">
          <header className="text-center mb-8 lg:mb-12">
            <h1 className="font-medium text-3xl sm:text-4xl md:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-2%] sm:tracking-[-3%] lg:tracking-[-5%] mb-4 lg:mb-6 text-black">
              Schedule of Activities
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Join us for an exciting day filled with insights from industry
              leaders, innovative workshops, and networking opportunities in AI,
              Blockchain, and emerging technologies.
            </p>
          </header>
          <Agenda />
        </section>
      </main>
    </>
  );
}
