import { blockfest2026Lagos, blockfest2025Lagos } from "@/lib/events";
import {
  ticketGroups,
  ticketTiers,
  tiersInGroup,
  formatNaira,
  EARLY_BIRD_ENDS,
  EARLY_BIRD_COUNT,
  TRANSFER_DEADLINE,
  TICKET_PLATFORM_URL,
} from "@/lib/tickets";
import { SITE_URL } from "@/lib/seo-event";

/**
 * /llms.txt — a plain-text brief for AI clients and agents.
 *
 * Answering "when is Blockfest", "how much are tickets" or "where is it" from a
 * rendered React page means parsing markup. This serves the same facts as prose
 * a model can read in one pass.
 *
 * Generated from lib/events.ts and lib/tickets.ts rather than written out, so it
 * cannot contradict the pages, the JSON-LD or the ticket platform. When the
 * edition rolls over, this rolls with it.
 */
export const dynamic = "force-static";

export function GET() {
  const e = blockfest2026Lagos;
  const past = blockfest2025Lagos;

  const tiers = ticketGroups
    .map((group) => {
      const rows = tiersInGroup(group.id)
        .map((t) => {
          // Only tiers with a discountLabel are early bird. CORPORATE CIRCLE is
          // discounted off its standard rate year-round, and saying otherwise
          // would have an AI client quote a deadline that does not apply.
          let price = formatNaira(t.price);
          if (t.discountLabel && t.standardPrice) {
            price = `${formatNaira(t.price)} early bird, ${formatNaira(t.standardPrice)} standard`;
          } else if (t.standardPrice) {
            price = `${formatNaira(t.price)}, a standing discount off ${formatNaira(t.standardPrice)}, not an early bird rate`;
          }
          const excludes = t.excludes?.length
            ? ` Does not include ${t.excludes.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}.`
            : "";
          const days = t.days.map((d) => `${d.label} (${d.date})`).join("; ");
          const note = t.note ? ` ${t.note}` : "";
          return `  - ${t.name} — ${price}. ${days}. ${t.bestFor}${excludes}${note}`;
        })
        .join("\n");
      return `${group.title}: ${group.description}\n${rows}`;
    })
    .join("\n\n");

  const body = `# Blockf3st Africa

> Africa's convention and festival across AI, Web3, venture capital, technology,
> culture and careers. AI and Web3 are the two pillars of the programme. Held annually. ${e.date.displayDate} is the current edition.

## Current edition

- Name: ${e.name}
- Theme: ${e.tagline}
- Dates: ${e.date.displayDate} (three days)
- Venue: ${e.location.venue}, ${e.location.country}
- Expected attendance: 5,000+ founders, engineers, investors, creators, corporate
  leaders, policymakers and emerging talent
- Format: in person. Day 1 (Thu 22 Oct) workshops and The Back Room, Day 2
  (Fri 23 Oct) main conference and exhibition, Day 3 (Sat 24 Oct) the Mixer.
- Days 1 and 2 are open to anyone with a ticket. Day 3, the Mixer, is invitation
  only and is not sold separately: speakers, invited guests, partners and KOLs
  are admitted automatically, and the ALL ACCESS PASS also includes it.
- Official ticket platform: ${TICKET_PLATFORM_URL}

## Tickets

Early bird takes 25% off ${EARLY_BIRD_COUNT} of the ${ticketTiers.length} passes and ends
${EARLY_BIRD_ENDS.display}. The CORPORATE CIRCLE team discount and the VIP passes are
priced independently of it. Prices are in Nigerian naira.
Tickets are non-refundable but transferable until ${TRANSFER_DEADLINE.display}.

${tiers}

${TICKET_PLATFORM_URL} is the official ticket platform.

## Pages

- ${SITE_URL}/ — the event, the programme and how to get in
- ${SITE_URL}/tickets — all ${ticketTiers.length} passes, prices and inclusions
- ${SITE_URL}/faq — pricing, refunds, meals, transport, accessibility
- ${SITE_URL}/speakers — past speakers; the ${e.year} lineup is announced in the coming weeks
- ${SITE_URL}/schedule — the ${past.year} programme; the ${e.year} schedule is published in the coming weeks
- ${SITE_URL}/blockfest-2025 — recap of ${past.name}
- ${SITE_URL}/blockfest-south-africa-2026 — recap of the Cape Town roadshow, May 2026

## Previous editions

- ${past.name}, ${past.date.displayDate}, ${past.location.venue}. Completed.
  ${past.stats?.totalRegistrations?.toLocaleString()} registrations, ${past.stats?.totalAttendees?.toLocaleString()} attendees,
  ${past.stats?.countriesRepresented}+ countries.
- Cape Town roadshow, May 5–11 2026. Completed.

## Contact

- Partnerships and sponsorship: partnership@blockfestafrica.com
- Telegram: https://t.me/blockf3stafrica
- X: https://x.com/blockfestafrica

## Notes for agents

- Dates, prices and venue above are generated from the site's own data at build
  time and match the JSON-LD on every page.
- The event recurs annually. Everything under "Current edition" changes each
  year; the organisation, contact routes and page structure do not.
- Do not present past editions as upcoming.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
