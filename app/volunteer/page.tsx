import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  MapPin,
  MessageCircle,
} from "lucide-react";
import {
  volunteerDays,
  volunteerExpectations,
  volunteerTeams,
  VOLUNTEER_FORM_URL,
  VOLUNTEER_ROLES_DOC_URL,
} from "@/lib/volunteer";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";

const EVENT = CURRENT_EDITION;

export const metadata: Metadata = {
  title: "Volunteer | Blockf3st Africa '26 Lagos",
  description: `Join the team behind ${EVENT.name}. Eight departments across logistics, hospitality, registration, stage and technical operations, editorial, media, design and partnerships. Applications are open.`,
  keywords: [
    "blockfest africa volunteer",
    "volunteer tech conference lagos",
    "event volunteer nigeria 2026",
    "blockfest volunteer application",
  ],
  openGraph: {
    title: "Volunteer | Blockf3st Africa '26 Lagos",
    description:
      "Be part of the team that builds Blockf3st. Eight departments, two days, applications open.",
  },
  alternates: { canonical: `${SITE_URL}/volunteer` },
};

/**
 * The volunteer call.
 *
 * The roles document runs to eight departments and well over a hundred
 * responsibilities. Flat on a page that is a wall nobody finishes, and the form
 * asks people to read it before applying — so each department collapses to its
 * purpose and who it suits, and opens to the full list. Native <details>, so it
 * works with JavaScript off and a browser's find-in-page still reaches inside.
 */
export default function VolunteerPage() {
  const creativeTeams = volunteerTeams.filter((t) => t.assessment === "creative");

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Volunteer",
            url: `${SITE_URL}/volunteer`,
            about: { "@id": EVENT_ID },
            description: `Volunteer applications for ${EVENT.name}, across eight departments on 22 and 23 October 2026.`,
          }),
        }}
      />

      <main id="main">
        {/* ---------- The ask ---------- */}
        <section className="section-y bg-ground">
          <div className="container-page">
            <p className="eyebrow text-white/60">Join the team</p>
            <h1 className="text-display-sm mt-3 max-w-3xl font-bold text-white">
              Volunteer at Blockf3st Africa
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Volunteers are not event helpers here. They are part of the team
              that builds Blockf3st, before, during and after. Depending on your
              department you might be writing, filming, designing, running a
              stage, moving equipment or looking after the people who came a
              long way to be in the room.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              We are looking for reliable, proactive people. Placement is based
              on your skills, experience and availability, and on what the event
              actually needs.
            </p>

            {/* No apply link up here on purpose. The form asks people to read
                the roles before filling it in, so the only link to it sits at
                the foot of the page — a reader reaches it having passed the
                departments rather than instead of them. */}
            <div className="mt-8">
              <a
                href="#departments"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-7 text-base font-semibold text-white transition-colors duration-300 hover:bg-white/10"
              >
                See the {volunteerTeams.length} departments
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* ---------- When ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Two days on the floor
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              {EVENT.location.venue}. Expect long days, a lot of standing and
              walking, and problems to solve as they arrive.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {volunteerDays.map((day) => (
                <div
                  key={day.date}
                  className="rounded-xl border border-white/20 bg-white/5 p-6"
                >
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="eyebrow text-brand-gold">
                    {day.weekday} {day.date}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white lg:text-2xl">
                    {day.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                    {day.description}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 flex items-start gap-2 text-sm text-white/60">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Travelling in?{" "}
              <Link
                href="/travel"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Getting to Lagos
              </Link>{" "}
              covers the venue, accommodation and moving around the city.
            </p>
          </div>
        </section>

        {/* ---------- Departments ---------- */}
        <section
          id="departments"
          className="section-y bg-ground border-t border-white/20"
        >
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              {volunteerTeams.length} departments
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Open the one you are drawn to and read what it actually involves
              before you apply. You pick a department on the form, and the
              honest answer to &ldquo;which one?&rdquo; is usually in this list.
            </p>

            <div className="mt-8 flex flex-col gap-4">
              {volunteerTeams.map((team) => (
                <details
                  key={team.id}
                  id={team.id}
                  className="group rounded-xl border border-white/20 bg-white/5 transition-colors duration-300 open:bg-white/10 hover:bg-white/10"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block text-lg font-bold text-white lg:text-2xl">
                        {team.name}
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-white/60 lg:text-base">
                        {team.purpose}
                      </span>
                    </span>
                    <ChevronDown
                      className="mt-1 h-5 w-5 shrink-0 text-brand-gold transition-transform duration-200 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="border-t border-white/20 p-5 sm:p-6">
                    <p className="eyebrow text-white/60">What you would do</p>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {team.responsibilities.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-light"
                            aria-hidden="true"
                          />
                          <span className="text-sm leading-relaxed text-white/60 lg:text-base">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 border-t border-white/20 pt-4">
                      <p className="eyebrow text-white/60">Ideal for</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/60 lg:text-base">
                        {team.idealFor}
                      </p>
                    </div>

                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- What the form will ask ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Before you open the form
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              It is short, but two answers are worth preparing rather than
              improvising.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/20 bg-white/5 p-6">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-white lg:text-2xl">
                  If you are applying to a creative team
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                  {creativeTeams.map((t) => t.name).join(", ")}. You will be
                  asked what kind of creative you are, for{" "}
                  <span className="font-semibold text-white">
                    three links to previous work
                  </span>{" "}
                  and whether you can work to real-time deadlines. Have the
                  links ready.
                </p>
              </div>

              <div className="rounded-xl border border-white/20 bg-white/5 p-6">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-white lg:text-2xl">
                  If you are applying to an operations team
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                  You will be asked about any experience with crowd management,
                  customer service, AV equipment or venue operations, and to
                  describe{" "}
                  <span className="font-semibold text-white">
                    a time you solved a problem under pressure
                  </span>
                  . A real example beats a general one.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-6">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-white lg:text-2xl">
                Give a phone number that works on WhatsApp
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                Everything after selection happens on WhatsApp. If the number on
                your form is not reachable there, you will miss it.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Expectations ---------- */}
        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              What we ask of every volunteer
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Whichever department you land in. The form asks you to confirm you
              understand this before you submit.
            </p>

            {/* Columns, not a grid. A two-column grid stretched every
                one-line item to the height of its two-line neighbour and left
                a hole in the last row; flowing them balances instead. */}
            <ul className="mt-8 columns-1 gap-x-10 md:columns-2">
              {volunteerExpectations.map((item) => (
                <li
                  key={item}
                  className="mb-3 flex break-inside-avoid items-start gap-3"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-white/60 lg:text-base">
                    {item}
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
              <h2 className="text-display-sm font-bold text-white">
                Apply
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                Shortlisted volunteers are contacted for the next stage of
                selection. The email comes from a blockfestafrica.com address,
                so check your spam folder for it, and everything after that
                happens on WhatsApp.
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                <a
                  href={VOLUNTEER_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
                >
                  Open the application form
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={VOLUNTEER_ROLES_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Read the full roles document
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
