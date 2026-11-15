import type { Metadata } from "next";
import Link from "next/link";
import { StopEmails } from "@/components/campaigns/stop-emails";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";
import { monicaRoutes } from "@/lib/campaigns";
import { buttonClass } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Stop emails about future campaigns",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Where a future-campaigns email's "stop these emails" link lands
 * (lib/email-stop.ts).
 *
 * Opening it changes nothing; the button does. Mail scanners open every
 * link in a message, and a page that acted on load would unsubscribe
 * whoever's mail server happened to look. Campaign mail about an entry is
 * not affected, and the page says so.
 */
export default async function StopEmailsPage({
  searchParams,
}: {
  /* "s", never "t": t= is the personal login link's, and a test holds every
     bulk mail to never carrying one (bulk-email-copy.test.ts). */
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  const { s } = await searchParams;
  const token = typeof s === "string" ? s : "";

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-xl">
          <p className="eyebrow text-brand-gold">Blockfest Africa</p>
          <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
            Stop emails about future campaigns?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            When you registered for Monica: The Money Story you said yes to
            hearing about future campaigns. Press the button and we will not
            email you about them again. You do not need to give a reason.
          </p>

          <div className="mt-6">
            <StopEmails token={token} />
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-3">
            Changed your mind later, or something here did not work? Write to{" "}
            <a
              href={`mailto:${PRIVACY_CONTACT}`}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              {PRIVACY_CONTACT}
            </a>{" "}
            and a person will sort it out.
          </p>

          <div className="mt-8">
            <Link href={monicaRoutes.privacy} className={buttonClass("secondary")}>
              How we handle your details
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
