import { blockfest2026Lagos } from "./events";
import {
  TICKET_PLATFORM_URL,
  EARLY_BIRD_ENDS,
  ticketTiers,
  lowestTicketPrice,
} from "./tickets";

/**
 * Canonical structured data for the event.
 *
 * Blockf3st runs every year, so the facts split in two:
 *
 *   EVERGREEN  — organisation identity, brand names, social profiles, the
 *                site's purpose. Lives in ORGANISATION below and should not
 *                change from one edition to the next.
 *
 *   PER-EDITION — dates, venue, theme, prices, which city is next. None of it
 *                is written here: it is derived from `blockfest2026Lagos` in
 *                lib/events.ts and the tiers in lib/tickets.ts.
 *
 * To roll the site over to Lagos '27, change those two files and the constant
 * below. Every page's JSON-LD follows automatically, because pages reference
 * the event by @id rather than restating it.
 */
export const CURRENT_EDITION = blockfest2026Lagos;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://blockfestafrica.com";

/** Stable @id so pages can reference the event instead of duplicating it. */
export const EVENT_ID = `${SITE_URL}/#event-${CURRENT_EDITION.id}`;
export const ORGANISATION_ID = `${SITE_URL}/#organization`;

/** Evergreen. The organisation outlives any single edition. */
export const ORGANISATION = {
  "@type": "Organization",
  "@id": ORGANISATION_ID,
  name: "Blockfest Africa",
  alternateName: ["Blockf3st Africa", "Blockfest"],
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  email: "partnership@blockfestafrica.com",
  sameAs: [
    "https://x.com/blockfestafrica",
    "https://www.instagram.com/blockfestival_africa",
    "https://youtube.com/@blockchainfestivalafrica",
    "https://www.linkedin.com/company/blockfest-africa",
    "https://t.me/blockf3stafrica",
  ],
} as const;

/**
 * One AggregateOffer rather than ten Offer nodes: the tiers are the same
 * admission at different levels, and Google reads the range.
 */
function ticketOffer() {
  const prices = ticketTiers.map((tier) => tier.price);
  return {
    "@type": "AggregateOffer",
    url: TICKET_PLATFORM_URL,
    priceCurrency: "NGN",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: ticketTiers.length,
    availability: "https://schema.org/InStock",
    priceValidUntil: EARLY_BIRD_ENDS.iso.slice(0, 10),
  };
}

/**
 * The canonical Event node. Emit this once per page that is genuinely about
 * the event; everywhere else reference `{ "@id": EVENT_ID }`.
 */
export function eventJsonLd() {
  const e = CURRENT_EDITION;
  return {
    "@type": "Event",
    "@id": EVENT_ID,
    name: e.name,
    alternateName: `Blockfest Africa ${e.year}`,
    description: `${e.tagline}. Three days of building, networking and dealmaking with 5,000+ founders, engineers, investors and policymakers at ${e.location.venue}.`,
    startDate: e.date.start,
    endDate: e.date.end,
    eventStatus: "https://schema.org/EventScheduled",
    // Mixed, not offline. The main stage is livestreamed free on YouTube and X,
    // and in 2025 more people watched from home than were in the room. Declaring
    // it offline-only hid that from search and from AI clients.
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    location: [
      {
        "@type": "Place",
        name: e.location.venue,
        address: {
          "@type": "PostalAddress",
          streetAddress: e.location.venue,
          addressLocality: e.location.city,
          addressRegion: "Lagos State",
          addressCountry: e.location.countryCode,
        },
      },
      {
        "@type": "VirtualLocation",
        name: "Free livestream on YouTube and X",
        url: "https://youtube.com/@blockchainfestivalafrica",
      },
    ],
    organizer: { "@id": ORGANISATION_ID },
    performer: { "@id": ORGANISATION_ID },
    offers: ticketOffer(),
    image: [`${SITE_URL}/images/og-image.jpg`],
    url: `${SITE_URL}/tickets`,
    inLanguage: "en",
    typicalAgeRange: "18-",
  };
}

/** Lowest ticket price, for copy that quotes a "from" figure. */
export const fromPrice = lowestTicketPrice;
