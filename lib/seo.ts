import type { Metadata } from "next";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noIndex?: boolean;
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://blockfestafrica.com";
const siteName = "Blockfest Africa";
const twitterHandle =
  process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@blockfestafrica";
const defaultDescription =
  "Africa's premier blockchain conference bringing together builders, founders, investors, and enthusiasts to shape the future of Web3 in Africa.";
const defaultImage = `${siteUrl}/images/og-image.jpg`;

export function generateSEO({
  title,
  description = defaultDescription,
  keywords = [],
  image = defaultImage,
  url,
  type = "website",
  publishedTime,
  modifiedTime,
  author,
  noIndex = false,
}: SEOProps): Metadata {
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const canonicalUrl = url ? `${siteUrl}${url}` : siteUrl;

  const defaultKeywords = [
    "blockchain",
    "web3",
    "cryptocurrency",
    "africa",
    "conference",
    "bitcoin",
    "ethereum",
    "defi",
    "nft",
    "smart contracts",
    "fintech",
    "innovation",
  ];

  const allKeywords = [...defaultKeywords, ...keywords];

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: allKeywords,
    authors: author ? [{ name: author }] : undefined,
    robots: noIndex
      ? { index: false, follow: false }
      : {
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
      type,
      locale: "en_US",
      url: canonicalUrl,
      siteName,
      title: fullTitle,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      ...(type === "article" && {
        publishedTime,
        modifiedTime,
        authors: author ? [author] : undefined,
      }),
    },
    twitter: {
      card: "summary_large_image",
      site: twitterHandle,
      creator: twitterHandle,
      title: fullTitle,
      description,
      images: [image],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };

  return metadata;
}

// Event-specific structured data generator
export function generateEventStructuredData({
  name,
  description,
  startDate,
  endDate,
  location,
  venue,
  address,
  country = "NG",
  city,
  price = "0",
  currency = "USD",
  image,
  url,
}: {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location?: string;
  venue?: string;
  address?: string;
  country?: string;
  city?: string;
  price?: string;
  currency?: string;
  image?: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    description,
    startDate,
    endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venue || location || "Conference Center",
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
        addressLocality: city,
        addressCountry: country,
      },
    },
    image: image || defaultImage,
    url: url || siteUrl,
    organizer: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/register`,
    },
  };
}

// Social media sharing URLs
export const socialShareUrls = {
  twitter: (text: string, url: string) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`,
  facebook: (url: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  linkedin: (url: string, title: string, summary: string) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      url
    )}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(
      summary
    )}`,
  whatsapp: (text: string, url: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  telegram: (text: string, url: string) =>
    `https://t.me/share/url?url=${encodeURIComponent(
      url
    )}&text=${encodeURIComponent(text)}`,
};
