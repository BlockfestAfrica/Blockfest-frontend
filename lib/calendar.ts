import { blockfest2026Lagos } from "./events";
import { SITE_URL } from "./seo-event";

/**
 * Calendar entries for the current edition, generated from lib/events.ts.
 *
 * Someone who decides to come 70 days out has no way to hold the date; this
 * gives them one. Like everything else per-edition, it derives from the event
 * data rather than restating it, so it rolls over on its own.
 */
const EVENT = blockfest2026Lagos;

/** ICS wants UTC in YYYYMMDDTHHMMSSZ form. */
function toIcsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Long values must be folded at 75 octets, continuation lines start with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

const DESCRIPTION = `${EVENT.tagline}. Three days of building, networking and dealmaking. Tickets and full programme: ${SITE_URL}/tickets`;

/**
 * A complete VCALENDAR for the edition.
 *
 * DTSTAMP is fixed to the event start rather than "now" so the file is
 * byte-stable across builds — a changing timestamp would defeat caching and
 * make every deploy look like a modified calendar to subscribers.
 */
export function buildIcs(): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blockfest Africa//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${EVENT.id}@blockfestafrica.com`,
    `DTSTAMP:${toIcsStamp(EVENT.date.start)}`,
    `DTSTART:${toIcsStamp(EVENT.date.start)}`,
    `DTEND:${toIcsStamp(EVENT.date.end ?? EVENT.date.start)}`,
    fold(`SUMMARY:${escapeText(EVENT.name)}`),
    fold(`DESCRIPTION:${escapeText(DESCRIPTION)}`),
    fold(`LOCATION:${escapeText(locationLine())}`),
    fold(`URL:${SITE_URL}/tickets`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}

/** Google Calendar's "add event" URL, for people who never download files. */
export function googleCalendarUrl(): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", EVENT.name);
  url.searchParams.set(
    "dates",
    `${toIcsStamp(EVENT.date.start)}/${toIcsStamp(EVENT.date.end ?? EVENT.date.start)}`
  );
  url.searchParams.set("details", DESCRIPTION);
  url.searchParams.set("location", locationLine());
  return url.toString();
}

/** The venue string already contains the city, so avoid "Lagos, Lagos". */
function locationLine(): string {
  const { venue, city, country } = EVENT.location;
  const parts = venue?.includes(city) ? [venue, country] : [venue, city, country];
  return parts.filter(Boolean).join(", ");
}

/** Where the .ics is served. */
export const ICS_PATH = "/blockfest-africa.ics";
