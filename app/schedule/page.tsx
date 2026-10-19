import { PastAgenda } from "@/components/schedule/past-agenda";
import { RunOfShow } from "@/components/schedule/run-of-show";
import { gotham } from "@/lib/fonts";
import type { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";
import { EVENT_ID, CURRENT_EDITION } from "@/lib/seo-event";
import { jsonLd } from "@/lib/json-ld";

const TITLE = "Schedule | Blockfest Africa - Event Program & Activities";
const DESCRIPTION =
  "The Blockfest Africa Lagos '26 run of show: workshops and masterclasses on October 22 at Ibis Hotel, Lekki, and the main conference on October 23 at the National Art Theatre.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    "Blockfest Africa schedule, event program, run of show, blockchain conference schedule, tech conference activities, AI workshops",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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
    description: DESCRIPTION,
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
      description: `Programme of activities for ${CURRENT_EDITION.name} on ${CURRENT_EDITION.date.displayDate}.`,
    },
  };

  return (
    <>
      <BaseSchema type="WebPage" data={schedulePageData} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <main id="main" className={`${gotham.className} min-h-screen bg-paper`}>
        {/* Header Section */}
        <section className="section-y bg-ground">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow text-ink-3">Lagos &apos;26</p>
              <h1
                id="schedule-heading"
                className="text-display-sm mt-3 font-bold text-white"
              >
                Schedule of <span className="text-white">Activities</span>
              </h1>
              {/* One clause per day: the switcher below shows one day at a
                  time, so this is the only place a visitor learns, before a
                  tap, that the main conference is the Friday. The tabs carry
                  the dates, so the days are named here, not dated twice. */}
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
                Workshops on Thursday, the main conference on Friday. Times
                are Lagos time, and the programme may shift on the day.
              </p>
            </div>
          </div>
        </section>

        <section className="section-y bg-paper">
          <div className="container-page">
            <RunOfShow />
          </div>
        </section>

        <section
          aria-labelledby="past-agenda-heading"
          className="section-y border-t border-gray-200 bg-paper"
        >
          <div className="container-page">
            <h2
              id="past-agenda-heading"
              className="text-display-sm font-bold text-gray-900"
            >
              Last year&apos;s programme
            </h2>
            <p className="mb-8 mt-3 max-w-2xl text-base text-gray-600">
              For a feel of how a Blockfest Africa day runs, here is 2025.
            </p>
            <PastAgenda />
          </div>
        </section>
      </main>
    </>
  );
}
