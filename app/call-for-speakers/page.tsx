import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Mic, Users } from "lucide-react";
import { lagos2026Tracks } from "@/lib/events";
import {
  applicationChecklist,
  isSpeakerFormOpen,
  sessionFormats,
  speakerTerms,
  speakingDays,
  speakingDayShape,
} from "@/lib/speaking";
import { SpeakerApplyCTA } from "@/components/speakers/apply-cta";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";

const EVENT = CURRENT_EDITION;

const OG_TITLE = "Call for Speakers | Blockf3st Africa '26 Lagos";
// Counts come from the data so the share card cannot drift from the page body.
const OG_DESCRIPTION = `Pitch a session for ${EVENT.name}. ${lagos2026Tracks.length} tracks, ${sessionFormats.length} formats, 2 days in Lagos.`;

export const metadata: Metadata = {
  // The root layout appends "| Blockf3st Africa 2026", so branding here would
  // be the third copy in one title tag.
  title: "Call for Speakers",
  description: `Speaker applications for ${EVENT.name}, ${EVENT.date.displayDate}. Workshops and masterclasses on day one, panels and lightning talks on day two, across ${lagos2026Tracks.length} tracks spanning AI, blockchain, policy, capital, infrastructure, culture and careers.`,
  keywords: [
    "blockfest africa call for speakers",
    "speak at blockfest",
    "africa tech conference speakers 2026",
    "web3 ai speaker application lagos",
    "call for papers africa tech",
  ],
  // Next replaces these objects wholesale rather than merging them into the
  // layout's, so the image and url have to be restated or the card ships bare.
  openGraph: {
    type: "website",
    url: `${SITE_URL}/call-for-speakers`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/images/og-speakers.jpg`,
        width: 1200,
        height: 630,
        alt: `Call for speakers — ${EVENT.name}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE_URL}/images/twitter-speakers.jpg`],
  },
  alternates: { canonical: `${SITE_URL}/call-for-speakers` },
};

/**
 * The call for speakers.
 *
 * Written to be read before the form, not instead of it. The application runs
 * seven pages and asks for a bio, a session description, key takeaways and a
 * case for why you are the one to give it — so this page puts that list in
 * front of the button rather than behind it.
 */
export default function CallForSpeakersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Call for Speakers",
            url: `${SITE_URL}/call-for-speakers`,
            about: { "@id": EVENT_ID },
            description: `Speaker applications for ${EVENT.name} on ${EVENT.date.displayDate}.`,
          }),
        }}
      />

      <main id="main">
        {/* ---------- The ask ---------- */}
        <section className="section-y bg-ground">
          <div className="container-page">
            {/* One column on a phone, two from lg. Capping the copy at
                max-w-2xl and stacking it left leaves half a desktop empty,
                and widening the column instead would push line length past
                what is comfortable to read. Same 12-column shape the ticket
                hero uses. */}
            <div className="grid gap-x-12 gap-y-6 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-6">
                <p className="eyebrow text-white/60">Call for speakers</p>
                <h1 className="text-display-sm mt-3 font-bold text-white">
                  Take the stage in Lagos
                </h1>
              </div>

              <div className="lg:col-span-6 lg:pt-2">
                <p className="max-w-xl text-base leading-relaxed text-white/60 lg:max-w-none">
                  {speakingDays}. This year&rsquo;s theme is{" "}
                  <span className="font-semibold text-white">
                    {EVENT.tagline}
                  </span>
                  . What it takes to move African work onto open rails, and
                  what changes once it is there.
                </p>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60 lg:max-w-none">
                  We are looking for builders, operators, investors,
                  policymakers and creators with something specific to say. A
                  talk about one thing you have actually done beats a survey of
                  a field, and we would rather hear a real disagreement than a
                  safe consensus.
                </p>
              </div>
            </div>

            {/* The form asks for a bio, a session description, key takeaways
                and a case for delivering it. The apply control sits at the
                foot of the page so a reader meets that list before the
                button. */}
            <div className="mt-8">
              <a
                href="#formats"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-7 text-base font-semibold text-white transition-colors duration-300 hover:bg-white/10"
              >
                What we are looking for
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* ---------- Formats ---------- */}
        {/* scroll-mt clears the sticky navbar, which would otherwise sit on
            top of the heading this link jumps to. Matches the FAQ anchors. */}
        <section
          id="formats"
          className="section-y bg-ground scroll-mt-24 border-t border-white/20"
        >
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              {sessionFormats.length} formats, across two days
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Each day has its own shape, and each format belongs to one of
              them. Pick the one that fits the idea, not the one that sounds
              most senior. A sharp seven minutes is often worth more than a talk
              stretched to fill its slot, and a workshop people leave having
              built something beats both.
            </p>

            {/* The day picker and the format picker are separate questions on
                the form, but the answers constrain each other. Showing the two
                days first means the format cards below read as a choice within
                a day rather than a flat list of four unrelated options. */}
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {speakingDayShape.map((day) => (
                <div
                  key={day.label}
                  className="rounded-xl border border-white/20 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-lg font-bold text-white">
                      {day.label}
                    </h3>
                    <span className="eyebrow text-brand-gold">{day.time}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {day.detail}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
              You can also apply as open to either day.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {sessionFormats.map((format) => (
                <div
                  key={format.name}
                  className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
                >
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                    <Mic className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-lg font-bold text-white lg:text-2xl">
                      {format.name}
                    </h3>
                    <span className="eyebrow text-brand-gold">
                      {format.length}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                    {format.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Tracks ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              {lagos2026Tracks.length} tracks
            </h2>
            {/* Deliberately does not claim the form's track question offers
                these exact six labels — it groups them differently, and
                naming its options here would go stale the moment it changes. */}
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              The programme runs on these six. The application asks you to place
              your session, and lets you pick more than one, so if it sits
              across two, say so and say why.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {lagos2026Tracks.map((track) => (
                <div
                  key={track.title}
                  className="rounded-xl border border-white/20 bg-white/5 p-6"
                >
                  <h3 className="text-lg font-bold text-white">
                    {track.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {track.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- What to prepare ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Have these ready
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              The form needs a Google account and saves a draft as you go, so
              you can leave and come back. The writing is the slow part, though,
              and twenty minutes gathering this first is the difference between
              a considered application and an abandoned one.
            </p>

            {/* An ordered list, because it is one: these follow the order the
                form asks in. The rendered ordinals are decorative — the list
                element itself carries the numbering for assistive tech. */}
            <ol className="mt-8 flex list-none flex-col gap-4">
              {applicationChecklist.map((item, index) => (
                <li
                  key={item.title}
                  className="flex items-start gap-5 rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6"
                >
                  <span
                    className="eyebrow mt-0.5 shrink-0 tabular-nums text-brand-gold"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white lg:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60 lg:text-base">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Terms ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Before you apply
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              {speakerTerms.length} consent questions close the form. None of it
              should be a surprise by the time you get there.
            </p>

            <ul className="mt-8 columns-1 gap-x-10 lg:columns-2">
              {speakerTerms.map((term) => (
                <li
                  key={term}
                  className="mb-3 flex break-inside-avoid items-start gap-3"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-white/60 lg:text-base">
                    {term}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Apply ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <div className="max-w-2xl">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-display-sm font-bold text-white">
                {isSpeakerFormOpen ? "Apply" : "Applications open soon"}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                {isSpeakerFormOpen
                  ? "Sessions are selected on the strength of the idea and the fit with the programme, not on follower count."
                  : "The form is not live yet. Get what is above ready now and you will be able to move quickly when it opens. We announce it on X first."}
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                <SpeakerApplyCTA />
                <Link
                  href="/speakers"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  See who has spoken before
                </Link>
              </div>

              <p className="mt-8 text-sm leading-relaxed text-white/60">
                Coming in from outside Lagos?{" "}
                <Link
                  href="/travel"
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  Getting to Lagos
                </Link>{" "}
                covers the venue, visas and accommodation. Not a speaker but
                still want in?{" "}
                <Link
                  href="/volunteer"
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  Volunteering is open
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
