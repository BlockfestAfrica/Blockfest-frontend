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
} from "@/lib/speaking";
import { SpeakerApplyCTA } from "@/components/speakers/apply-cta";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";

const EVENT = CURRENT_EDITION;

export const metadata: Metadata = {
  title: "Call for Speakers | Blockf3st Africa '26 Lagos",
  description: `Speaker applications for ${EVENT.name}, ${EVENT.date.displayDate}. Keynotes, panels, fireside chats and lightning talks across six tracks spanning AI, blockchain, policy, capital, infrastructure, culture and careers.`,
  keywords: [
    "blockfest africa call for speakers",
    "speak at blockfest",
    "africa tech conference speakers 2026",
    "web3 ai speaker application lagos",
    "call for papers africa tech",
  ],
  openGraph: {
    title: "Call for Speakers | Blockf3st Africa '26 Lagos",
    description: `Pitch a session for ${EVENT.name}. Six tracks, four formats, one stage in Lagos.`,
  },
  alternates: { canonical: `${SITE_URL}/call-for-speakers` },
};

/**
 * The call for speakers.
 *
 * Written to be read before the form exists. Last year's application asked for
 * a headshot, a bio, a 100 to 200 word session description and a line on how
 * the topic meets the theme, all in one sitting — so this page says that up
 * front, and the apply control announces itself rather than pretending to work.
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
            <p className="eyebrow text-white/60">Call for speakers</p>
            <h1 className="text-display-sm mt-3 max-w-3xl font-bold text-white">
              Take the stage in Lagos
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              {speakingDays}. This year&rsquo;s theme is{" "}
              <span className="font-semibold text-white">
                {EVENT.tagline}
              </span>{" "}
              — what it takes to move African work onto open rails, and what
              changes once it is there.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              We are looking for builders, operators, investors, policymakers
              and creators with something specific to say. A talk about one
              thing you have actually done beats a survey of a field, and we
              would rather hear a real disagreement than a safe consensus.
            </p>

            {/* The form asks for a bio, a headshot and a written session
                description in one sitting. The apply control sits at the foot
                of the page so a reader meets that list before the button. */}
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
        <section
          id="formats"
          className="section-y bg-ground border-t border-white/20"
        >
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Four formats
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Pick the one that fits the idea, not the one that sounds most
              senior. A sharp seven minutes is often worth more than a keynote
              stretched to fill its slot.
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
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              The application asks which one your session belongs to. If it sits
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
              The form asks for all of it in one sitting, and there is no saving
              halfway. Twenty minutes gathering this first is the difference
              between a considered application and an abandoned one.
            </p>

            <div className="mt-8 flex flex-col gap-4">
              {applicationChecklist.map((item, index) => (
                <div
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Terms ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Before you apply
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              The form asks you to agree to each of these, so none of it should
              be a surprise when you get there.
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
                  : "The form is not live yet. Get what is above ready now and you will be able to submit in one sitting when it opens. We announce it on X first."}
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
