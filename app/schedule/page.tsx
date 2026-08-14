import { PastAgenda } from "@/components/schedule/past-agenda";
import { gotham } from "@/lib/fonts";
import type { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";
import { ComingSoonNotice } from "@/components/shared/coming-soon-notice";
import { EVENT_ID, CURRENT_EDITION } from "@/lib/seo-event";

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
  // /schedule is where crawlers look for "when is Blockfest". Point them at the
  // canonical current edition rather than at the finished 2025 programme this
  // page archives.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [{ "@id": EVENT_ID }],
  };

  const schedulePageData = {
    name: `Schedule - ${CURRENT_EDITION.name}`,
    description:
      "The Lagos '26 three-day programme is published in the coming weeks. Meanwhile, see how the 2025 edition ran: keynotes, workshops, panels and networking.",
    url: "https://blockfestafrica.com/schedule",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: { "@id": EVENT_ID },
    // The page is about the current edition. It said 2025, which told crawlers
    // this route was last year's programme.
    mainEntity: {
      "@type": "EventSchedule",
      name: `${CURRENT_EDITION.name} Schedule`,
      description: `Programme of activities for ${CURRENT_EDITION.name} on ${CURRENT_EDITION.date.displayDate}. Times are published closer to the event.`,
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
          description="The Lagos '26 programme is published in the coming weeks. October 22 is the workshop and The Back Room, October 23 the main conference, October 24 the invitation-only Mixer."
        />

        {/* Header Section */}
        <section className="section-y bg-ground">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow text-white/60">Lagos &apos;26</p>
              <h1
                id="schedule-heading"
                className="text-display-sm mt-3 font-bold text-white"
              >
                Schedule of <span className="text-white">Activities</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
                Times for October 22 to 24 land in the coming weeks.
                Last year&apos;s programme is a good guide to the shape of the
                days.
              </p>
            </div>
          </div>
        </section>

        <section className="section-y bg-paper">
          <div className="container-page">
            <PastAgenda />
          </div>
        </section>
      </main>
    </>
  );
}
