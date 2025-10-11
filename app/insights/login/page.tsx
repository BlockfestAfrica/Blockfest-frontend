import { Metadata } from "next";
import { LoginForm } from "@/components/insights/login-form";
import { BaseSchema } from "@/components/seo/schema-markup";

export const metadata: Metadata = {
  title: "Insights Login | Blockfest Africa",
  description: "Login to access Blockfest Africa event insights",
  robots: "noindex, nofollow, noarchive, nosnippet", // Keep completely private
};

export default function InsightsLoginPage() {
  const loginPageData = {
    name: "Insights Login - Blockfest Africa 2025",
    description:
      "Secure login access for Blockfest Africa event insights and analytics",
    url: "https://blockfestafrica.com/insights/login",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators.",
      startDate: "2025-10-11T08:00:00+01:00",
      endDate: "2025-10-11T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: "Landmark Event Center",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Landmark Event Center",
          addressLocality: "Lagos",
          addressRegion: "Lagos State",
          postalCode: "101001",
          addressCountry: "NG",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: "6.4474",
          longitude: "3.4126",
        },
      },
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
        email: "partnership@blockfestafrica.com",
        sameAs: [
          "https://twitter.com/blockfestafrica",
          "https://www.instagram.com/blockfestival_africa?igsh=NG1ma2p1aXV2OHk2&utm_source=qr",
          "https://youtube.com/@blockchainfestivalafrica?si=UhSMNPr7GIfOzZk9",
          "https://linkedin.com/company/blockfest-africa",
          "https://t.me/blockf3stafrica",
        ],
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
        description: "Free admission to Blockfest Africa 2025",
      },
      performer: [
        {
          "@type": "Organization",
          name: "Blockfest Africa",
          url: "https://blockfestafrica.com",
        },
      ],
    },
    accessMode: "restricted",
    isAccessibleForFree: false,
  };

  return (
    <>
      <BaseSchema type="WebPage" data={loginPageData} />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
        {/* Disable Umami tracking for this page */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if (typeof window !== 'undefined') {
              // Disable Umami tracking for this page
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('umami.disabled', 'true');
              }
              // Also disable via window object if available
              if (window.umami) {
                window.umami.disabled = true;
              }
            }
          `,
          }}
        />

        <LoginForm />
      </div>
    </>
  );
}
