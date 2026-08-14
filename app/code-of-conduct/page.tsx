import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";

const EVENT = CURRENT_EDITION;

export const metadata: Metadata = {
  title: "Code of Conduct | Blockf3st Africa",
  description:
    "What we expect of everyone at Blockf3st Africa, what is not tolerated, and how to report a problem during the event.",
  keywords: [
    "blockfest africa code of conduct",
    "conference code of conduct nigeria",
    "tech event safety policy",
  ],
  openGraph: {
    title: "Code of Conduct | Blockf3st Africa",
    description:
      "What we expect of everyone at Blockf3st Africa, and how to report a problem.",
  },
  alternates: { canonical: `${SITE_URL}/code-of-conduct` },
};

/**
 * Evergreen. This applies to every edition, so it says nothing about a
 * particular year beyond the venue it derives.
 */
export default function CodeOfConductPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Code of Conduct",
            url: `${SITE_URL}/code-of-conduct`,
            about: { "@id": EVENT_ID },
          }),
        }}
      />

      <main id="main">
        <section className="section-y bg-ground">
          <div className="container-page">
            <p className="eyebrow text-white/60">Everyone who attends</p>
            <h1 className="text-display-sm mt-3 max-w-3xl font-bold text-white">
              Code of Conduct
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              Blockf3st Africa is a place to build, learn and do business. That
              only works if everyone in the room is safe and treated with
              respect. This applies to attendees, speakers, sponsors, partners,
              volunteers, press and staff, in every space we run.
            </p>
          </div>
        </section>

        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="What we expect">
                <ul className="flex flex-col gap-3">
                  {[
                    "Treat everyone with respect, whatever their background, gender, race, religion, disability, age or level of experience.",
                    "Assume the person you are talking to knows something you do not.",
                    "Ask before photographing or recording someone up close, and stop if asked.",
                    "Respect the room. The Back Room and closed sessions are off the record unless the organisers say otherwise.",
                    "Follow the instructions of staff and venue security.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-light"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="What is not tolerated">
                <ul className="flex flex-col gap-3">
                  {[
                    "Harassment of any kind, including unwelcome attention, following, or persistent contact after being asked to stop.",
                    "Comments that demean people for who they are rather than engage with what they said.",
                    "Unwanted physical contact.",
                    "Recording or photographing someone who has asked you not to.",
                    "Disrupting talks, sessions or the exhibition floor.",
                    "Soliciting, scamming or pressuring people into financial decisions. Nobody from Blockf3st will ask you to send funds.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-6">
              <h2 className="text-lg font-bold text-white lg:text-2xl">
                Reporting a problem
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-white/60 lg:text-base">
                <p>
                  If something happens, or you see something happen, tell any
                  member of staff at {EVENT.location.venue}. Staff are
                  identifiable by their badges, and the registration desk can
                  always find someone who can help.
                </p>
                <p>
                  You can also email{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Code of Conduct report`}
                    className="text-link underline underline-offset-2 hover:text-white"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  , during the event or after it. Reports are handled
                  discreetly, and we will not share your name with the person
                  you are reporting without your agreement.
                </p>
                <p>
                  If you are in immediate danger, find venue security or call
                  the Lagos State emergency line on{" "}
                  <a
                    href="tel:112"
                    className="font-semibold text-white underline underline-offset-2"
                  >
                    112
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-6">
              <h2 className="text-lg font-bold text-white lg:text-2xl">
                What happens next
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/60 lg:text-base">
                Organisers may take any action they judge appropriate, including
                a warning, removal from a session or the venue, revoking a pass
                without refund, or a ban from future editions. Speakers,
                sponsors and partners are held to the same standard as everyone
                else.
              </p>
            </div>

            <p className="mt-8 text-sm text-white/60">
              Questions about this policy:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              ·{" "}
              <Link
                href="/faq"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Read the FAQ
              </Link>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white lg:text-2xl">{title}</h2>
      <div className="mt-4 text-sm leading-relaxed text-white/60 lg:text-base">
        {children}
      </div>
    </div>
  );
}
