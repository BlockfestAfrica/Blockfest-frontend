import type { Metadata } from "next";
import "./globals.css";
import "./section-system.css";
import Footer from "@/components/shared/footer";
import Navbar from "@/components/shared/navbar";
import { AnnouncementBar } from "@/components/shared/announcement-bar";
import { Toaster } from "@/components/ui/sonner";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { gotham } from "@/lib/fonts";
import { ORGANISATION, eventJsonLd } from "@/lib/seo-event";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://blockfestafrica.com";
const siteName = "Blockf3st Africa 2026";
const siteDescription =
  "The Superbowl of Web3 - Africa's premier Web3 and AI conference. After the South Africa roadshow, join us in Lagos (October 22–24, 2026). New Trade Routes: Bringing Africa Onchain.";
const twitterHandle =
  process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@blockfestafrica";
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "blockchain",
    "web3",
    "cryptocurrency",
    "africa",
    "south africa",
    "nigeria",
    "cape town",
    "lagos",
    "conference",
    "bitcoin",
    "ethereum",
    "defi",
    "nft",
    "smart contracts",
    "decentralized",
    "fintech",
    "innovation",
    "technology",
    "networking",
    "startup",
    "venture capital",
    "developers",
    "builders",
    "blockfest 2026",
    "superbowl of web3",
    "artificial intelligence",
    "ai africa",
    "ai conference africa",
  ],
  authors: [
    {
      name: "Blockfest Africa",
      url: siteUrl,
    },
  ],
  creator: "Blockfest Africa",
  publisher: "Blockfest Africa",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/images/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Blockfest Africa - Premier Blockchain Conference",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: twitterHandle,
    creator: twitterHandle,
    title: siteName,
    description: siteDescription,
    images: [`${siteUrl}/images/twitter-image.jpg`],
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: googleVerification
    ? {
        google: googleVerification,
      }
    : undefined,
  category: "technology",
  classification: "Business",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": siteName,
    "application-name": siteName,
    "msapplication-TileColor": "#0A1628",
    "theme-color": "#0A1628",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0A1628",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // One graph for the whole site: the organisation and the current edition are
  // defined here and referenced by @id from every page, so no page can restate
  // a date, venue or price and drift out of sync.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANISATION,
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        description: siteDescription,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en",
      },
      eventJsonLd(),
    ],
  };

  return (
    <html lang="en">
      <head>
        {/* Performance optimization: preconnect to external domains */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />

        {/* DNS prefetch for social media domains */}
        <link rel="dns-prefetch" href="//twitter.com" />
        <link rel="dns-prefetch" href="//linkedin.com" />
        <link rel="dns-prefetch" href="//instagram.com" />
        <link rel="dns-prefetch" href="//youtube.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {/* Umami Analytics */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID &&
          process.env.NEXT_PUBLIC_UMAMI_SRC && (
            <script
              async
              src={process.env.NEXT_PUBLIC_UMAMI_SRC}
              data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
              data-auto-track="false"
              {...(process.env.NODE_ENV === "production" && {
                "data-domains":
                  process.env.NEXT_PUBLIC_SITE_URL?.replace(
                    /https?:\/\//,
                    ""
                  ) || "blockfestafrica.com",
              })}
            />
          )}

        {/* Manual Umami tracking initialization - excludes insights pages */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID &&
          process.env.NEXT_PUBLIC_UMAMI_SRC && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.addEventListener('DOMContentLoaded', function() {
                    // Only track if not on insights pages
                    if (!window.location.pathname.startsWith('/insights')) {
                      if (window.umami) {
                        window.umami.pageView();
                      }
                    }
                  });
                `,
              }}
            />
          )}

        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${gotham.className} ${gotham.variable} antialiased w-full mx-auto [@media(min-width:1920px)]:max-w-[1440px]`}
        suppressHydrationWarning={true}
      >
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PerformanceMonitor />
        <AnnouncementBar />
        <Navbar />
        {children}
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
