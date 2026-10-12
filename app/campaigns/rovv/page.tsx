import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignPhasePill } from "@/components/campaigns/campaign-phase-pill";
import { RovvHeroActions } from "@/components/campaigns/rovv-hero-actions";
import { RovvEntryForm } from "@/components/campaigns/rovv-entry-form";
import { TrackView } from "@/components/campaigns/track-view";
import { CONTACT_EMAIL } from "@/lib/constants";
import { campaignBySlug, campaignOpensLabel, campaignPhase, campaignRun } from "@/lib/campaigns";
import { ROVV, ROVV_SLUG, rovvRoutes } from "@/lib/rovv";
import { publicRovvWinners } from "@/lib/rovv-winners";
import { ROVV_EVENTS } from "@/lib/sabilytics";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(ROVV_SLUG)!;

const OG_TITLE = "If ROVV Takes Me to Blockfest… | Blockf3st Africa";
const OG_DESCRIPTION = `Make a TikTok on the prompt, tag ${ROVV.rovvHandle} and ${ROVV.blockfestHandle} with ${ROVV.hashtag}, and win one of ${ROVV.winners} tickets to Blockfest Africa 2026.`;

export const metadata: Metadata = {
  title: "If ROVV Takes Me to Blockfest",
  description: OG_DESCRIPTION,
  keywords: ["rovv blockfest", "ROVVMeToBlockfest", "blockfest africa tiktok campaign", "win blockfest ticket"],
  openGraph: {
    type: "website",
    url: `${SITE_URL}${rovvRoutes.home}`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [{ url: `${SITE_URL}/images/og-image.jpg`, width: 1200, height: 630, alt: ROVV.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE_URL}/images/twitter-image.jpg`],
  },
  alternates: { canonical: `${SITE_URL}${rovvRoutes.home}` },
};

/**
 * Rebuilt at most every five minutes, for the winners list: it appears once
 * winners are emailed, and nothing else on the page reads the database.
 */
export const revalidate = 300;

/* Where to get the app: the store links once ROVV gives them, and until
   then an honest "search for it" rather than a guessed URL. */
const appLinks = [
  ROVV.appLinks.android ? { label: "Get ROVV for Android", href: ROVV.appLinks.android } : null,
  ROVV.appLinks.ios ? { label: "Get ROVV for iPhone", href: ROVV.appLinks.ios } : null,
].filter((x): x is { label: string; href: string } => Boolean(x));

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Make a TikTok on the prompt",
    body: "“If ROVV takes me to Blockfest…” Finish it however you like. The format is yours.",
  },
  {
    title: "Post it publicly",
    body: `Tag ${ROVV.rovvHandle} and ${ROVV.blockfestHandle}, and use ${ROVV.hashtag}.`,
  },
  {
    title: "Register on the ROVV app",
    body:
      appLinks.length > 0 ? (
        <>
          Download the ROVV app, register, and find your referral code in the app.{" "}
          {appLinks.map((l, i) => (
            <span key={l.href}>
              {i > 0 ? " · " : ""}
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-link underline underline-offset-2 hover:text-white">
                {l.label}
              </a>
            </span>
          ))}
        </>
      ) : (
        "Search for ROVV in the Google Play Store or the App Store, download it, register, and find your referral code in the app."
      ),
  },
  {
    title: "Copy your video's link",
    body: "On TikTok, tap Share on your video, then Copy link.",
  },
  {
    title: "Enter below",
    body: "Your name, email, TikTok username, the link and your ROVV referral code. One entry each.",
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Who can enter?",
    a: "Anyone aged 18 or over who can attend Blockfest Africa 2026 in Lagos on Friday 23 October, the day the prize is for.",
  },
  {
    q: "Can I enter more than once?",
    a: "No, one entry each. If you made a mistake, send the form again before the close with the same email address and TikTok username, and your new details replace the old ones, as long as the team has not accepted your entry yet.",
  },
  {
    q: "What if my entry is ruled out?",
    a: "We email you the reason. Fix it, then send the form again before the close with the same email address and TikTok username, and it goes back to the team.",
  },
  {
    q: "How are winners chosen?",
    a: `The team watches every entry and picks ${ROVV.winners} for creativity and relevance to the prompt, the day after entries close. Views, likes and follower counts do not decide it. Winners are announced by ${ROVV.winnersByLabel}.`,
  },
  {
    q: "What do winners get?",
    a: `One ${ROVV.prize} each, for ${ROVV.prizeDay}: the main stage and the exhibition area. We email you a code that takes the full price off, and you register for the pass in your own name whenever you like. It cannot be exchanged for cash, and travel is not included.`,
  },
  {
    q: "Why do you need my ROVV referral code?",
    a: (
      <>
        Registering on the ROVV app is part of entering, and the code is how ROVV confirms you did. We share your name,
        email address, TikTok username and referral code with ROVV for that, as the{" "}
        <Link href={rovvRoutes.privacy} className="text-link underline underline-offset-2 hover:text-white">
          privacy notice
        </Link>{" "}
        explains.
      </>
    ),
  },
  {
    q: "How long does my video have to stay up?",
    a: "Keep it public, with its tags and hashtag, until Saturday 24 October 2026.",
  },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow text-ink-4">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

/**
 * Rovv's campaign: the prompt, how to enter, the form, and the winners once
 * they have been told. One page, because the whole thing is one action and
 * the brief asks for the entry to happen "on the Blockfest campaign page".
 */
export default async function RovvCampaignPage() {
  const winners = await publicRovvWinners();
  const run = campaignRun(CAMPAIGN);
  /* As of this render. The page is rebuilt at most five minutes apart, so
     what is decided here (which sections show) is never more than that
     behind; the buttons and the form follow the visitor's own clock. */
  const phase = campaignPhase(CAMPAIGN);
  const closed = phase === "closed";

  return (
    <main id="main" className="bg-ground">
      <TrackView event={ROVV_EVENTS.viewed} />

      <section className="bg-ground pb-10 pt-6 sm:pb-14 sm:pt-8">
        <div className="container-page">
          <Link
            href="/campaigns"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All campaigns
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-16">
            <div className="lg:col-span-7">
              <p className="eyebrow text-ink-3">Blockfest Africa with ROVV</p>
              <h1 className="mt-5 text-balance text-[clamp(2.25rem,5.2vw,4rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
                {ROVV.title}
              </h1>
              <p className="mt-4 text-2xl font-bold text-brand-gold sm:text-3xl">{ROVV.hashtag}</p>
              <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-2">
                Make a TikTok on the prompt. The {ROVV.winners} most creative each win a {ROVV.prize} to Blockfest
                Africa 2026&apos;s Conference Day, Friday 23 October in Lagos.
              </p>
              <RovvHeroActions campaign={CAMPAIGN} initial={phase} winners={winners.length} />
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-line-2 bg-card-2 p-6 sm:p-8">
                <CampaignPhasePill
                  campaign={CAMPAIGN}
                  initial={phase}
                  opensLabel={campaignOpensLabel(CAMPAIGN)}
                />
                <dl className="mt-7 flex flex-col gap-7">
                  <Fact label="Prizes">
                    <p className="text-display-sm font-bold tabular-nums leading-none text-white">
                      {ROVV.winners} tickets
                    </p>
                    <p className="mt-2 text-sm text-ink-3">
                      One {ROVV.prize} each, for Conference Day on Friday 23 October.
                    </p>
                  </Fact>
                  {run && (
                    <Fact label="Entries">
                      <p className="text-base font-semibold text-white">{run}</p>
                      <p className="mt-1 text-sm text-ink-3">
                        {closed ? "Closed" : "Closes"} 11:59 PM on Sunday 18 October, Lagos time.
                      </p>
                    </Fact>
                  )}
                  <Fact label="Winners">
                    <p className="text-base font-semibold text-white">
                      {winners.length > 0 ? "Announced" : "By 4 PM, Monday 19 October"}
                    </p>
                    <p className="mt-1 text-sm text-ink-3">
                      {winners.length > 0 ? (
                        <a href="#winners" className="text-link underline underline-offset-2 hover:text-white">
                          See who won
                        </a>
                      ) : (
                        "Emailed their code, then listed on this page."
                      )}
                    </p>
                  </Fact>
                  <Fact label="With">
                    {/* On a white chip, as the partner sections do it: the
                        wordmark is purple and sinks into the dark ground. */}
                    <a
                      href={ROVV.rovvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-white px-3 py-2"
                    >
                      <Image
                        src="/2026/logos/rovv.png"
                        alt="ROVV"
                        width={112}
                        height={25}
                        className="h-5 w-auto object-contain"
                        priority
                      />
                    </a>
                  </Fact>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      {winners.length > 0 && (
        <section aria-labelledby="winners" className="border-t border-line py-14 sm:py-16">
          <div className="container-page max-w-4xl">
            <h2 id="winners" className="text-2xl font-bold text-white sm:text-3xl">
              The winners
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-3">
              Congratulations. Each wins a {ROVV.prize} to Blockfest Africa 2026&apos;s Conference Day, and has been
              emailed their code.
            </p>
            <ul className="mt-8 flex flex-wrap gap-3">
              {winners.map((handle) => (
                <li key={handle}>
                  <a
                    href={`https://www.tiktok.com/@${encodeURIComponent(handle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-4 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20"
                  >
                    @{handle}
                  </a>
                </li>
              ))}
            </ul>
            {winners.length < ROVV.winners && (
              <p className="mt-6 text-sm text-ink-3">More winners are being told now, and appear here once they have been emailed.</p>
            )}
            <div className="mt-8 flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-ink-3">
              <p>
                Listed here, but no email from us? Check Spam and Promotions for mail from Blockfest Africa, then write
                to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-link underline underline-offset-2 hover:text-white">
                  {CONTACT_EMAIL}
                </a>{" "}
                from the address you entered with.
              </p>
              <p>Not on the list? Thank you for entering, and we hope to see you at Blockfest.</p>
            </div>
          </div>
        </section>
      )}

      {!closed && (
      <section aria-labelledby="how" className="border-t border-line py-14 sm:py-16">
        <div className="container-page max-w-4xl">
          <h2 id="how" className="text-2xl font-bold text-white sm:text-3xl">
            How to enter
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-xl border border-line-2 bg-card p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold tabular-nums text-black">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      )}

      <section id="enter" aria-labelledby="enter-heading" className="scroll-mt-20 border-t border-line py-14 sm:py-16">
        <div className="container-page max-w-3xl">
          <h2 id="enter-heading" className="text-2xl font-bold text-white sm:text-3xl">
            Send your entry
          </h2>
          {!closed && (
            <>
              <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-3">
                Post your video and register on the ROVV app first. Every field is needed.
              </p>
              {/* The rules that most often rule a video out, where the
                  decision to send is made, not only on the rules page. */}
              <div className="mt-6 rounded-xl border border-line-2 bg-card p-5">
                <p className="text-sm font-semibold text-white">Before you send, check your video:</p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-4">
                  <li>is your own original work, on the prompt;</li>
                  <li>
                    is public, tags {ROVV.rovvHandle} and {ROVV.blockfestHandle}, and uses {ROVV.hashtag};
                  </li>
                  <li>was not filmed while driving or riding;</li>
                  <li>and that you have registered on the ROVV app and can be in Lagos on Friday 23 October.</li>
                </ul>
              </div>
            </>
          )}
          <noscript>
            <p className="mt-6 rounded-lg border border-line-2 bg-card-2 px-4 py-3 text-sm text-ink-2">
              The entry form needs JavaScript. In TikTok or Instagram, tap the ⋯ menu, then &quot;Open in browser&quot;.
            </p>
          </noscript>
          <div className="mt-8">
            <RovvEntryForm />
          </div>
        </div>
      </section>

      <section aria-labelledby="faq" className="border-t border-line py-14 sm:py-16">
        <div className="container-page max-w-3xl">
          <h2 id="faq" className="text-2xl font-bold text-white sm:text-3xl">
            Questions
          </h2>
          <div className="mt-8 flex flex-col divide-y divide-line border-y border-line">
            {FAQS.map((item) => (
              <details key={item.q} className="group py-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-semibold text-white">
                  {item.q}
                  <span className="text-xl leading-none text-ink-4 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="pb-5 text-base leading-relaxed text-ink-3">{item.a}</div>
              </details>
            ))}
          </div>
          <p className="mt-8 text-sm leading-relaxed text-ink-4">
            The full terms are in the{" "}
            <Link href={rovvRoutes.rules} className="text-link underline underline-offset-2 hover:text-white">
              campaign rules
            </Link>{" "}
            and the{" "}
            <Link href={rovvRoutes.privacy} className="text-link underline underline-offset-2 hover:text-white">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
