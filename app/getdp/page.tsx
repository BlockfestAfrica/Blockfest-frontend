import type { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";
import { EVENT_ID } from "@/lib/seo-event";
import DPGenerator from "./components/DPGenerator";
import { GETDP_URL, publicDaysRange } from "./lib/dp";
import { pageTiers } from "./lib/tiers.server";

const TITLE = "Get your Blockfest Africa 2026 DP";
const DESCRIPTION =
  "Make your Blockfest Africa 2026 display picture: say whether you are attending, speaking, volunteering or partnering, add your name and photo, and download it. Your photo stays on your device.";
/** The card under every shared post's /getdp link: this page, and only the public days. */
const SHARE_DESCRIPTION = `Make your Blockfest Africa 2026 DP for ${publicDaysRange()} in Lagos, and share it. Your photo stays on your device.`;
const SITE = new URL(GETDP_URL).origin;

export const metadata: Metadata = {
  // The root layout appends "| Blockf3st Africa 2026", so the tab says "Get
  // your DP | Blockf3st Africa 2026" rather than naming the event twice. The
  // share cards below keep the full title, since they have no template.
  title: "Get your DP",
  description: DESCRIPTION,
  keywords: ["blockfest", "africa", "dp", "display picture", "lagos", "2026"],
  alternates: {
    canonical: GETDP_URL,
  },
  // Set in full: a page's openGraph and twitter replace the layout's rather
  // than adding to them, and the layout's name the homepage and all three days.
  openGraph: {
    type: "website",
    url: GETDP_URL,
    siteName: "Blockfest Africa",
    title: TITLE,
    description: SHARE_DESCRIPTION,
    images: [
      {
        url: `${SITE}/images/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Blockfest Africa 2026, Lagos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@blockfestafrica",
    title: TITLE,
    description: SHARE_DESCRIPTION,
    images: [`${SITE}/images/twitter-image.jpg`],
  },
};

export default function GetDPPage() {
  const tiers = pageTiers();

  const pageData = {
    name: TITLE,
    description: DESCRIPTION,
    url: GETDP_URL,
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    // A DP tool is not the event. Reference the canonical Event by @id
    // rather than restating dates and prices that would drift.
    about: { "@id": EVENT_ID },
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Blockfest Africa 2026 DP generator",
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "NGN",
      },
    },
  };

  return (
    <>
      <BaseSchema type="WebPage" data={pageData} />
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-5xl">
            <p className="eyebrow text-brand-gold">Blockfest Africa 2026 · Lagos</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              Get your DP
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
              Your picture for {publicDaysRange()} in Lagos, for your profile
              and your posts. Say how you&apos;re coming, add your name and a
              photo, then share it or save it.
            </p>
            <DPGenerator tiers={tiers} />
          </div>
        </section>
      </main>
    </>
  );
}
