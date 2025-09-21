import { Agenda } from "@/components/agenda";
import { gotham } from "@/lib/fonts";
import type { Metadata } from "next";

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
    name: "Blockfest Africa",
    description: "Premier blockchain and technology conference in Africa",
    startDate: "2025-10-11T08:30:00+01:00",
    endDate: "2025-10-11T17:30:00+01:00",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: "Blockfest Africa",
    },
  };

  return (
    <>
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
