import { monicaStages, monicaRoutes, type CampaignStage } from "@/lib/campaigns";
import { SITE_URL } from "@/lib/seo-event";

/**
 * The stage deadlines as calendar entries, so a phone says it, not an inbox.
 *
 * A creator read "closes today at 12:00" as midnight and missed stage 2; the
 * reminder that would have caught it was read after noon. A calendar alert
 * fires at the right time on the device people actually look at, in their
 * own time zone. Each remaining deadline is one short event ending at the
 * close, with an alert three hours before and another a day before.
 *
 * The alerts are timed from the event's start, which every calendar reads
 * the same way; Outlook ignores RELATED=END and keeps only the first alert,
 * so the three-hour one, the one that matters most, comes first.
 *
 * Generated from monicaStages, the instants the challenges were seeded with
 * and that the console cannot edit, so the calendar says what the engine
 * enforces.
 */

/** ICS wants UTC in YYYYMMDDTHHMMSSZ form. */
const stamp = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 text escaping. */
const text = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Long lines fold at 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

const HALF_HOUR = 30 * 60 * 1000;

const summary = (stage: CampaignStage) => `Monica stage ${stage.number} closes (12:00 noon, Lagos)`;
const details = () =>
  `Submissions close at 12:00 noon Lagos time: midday, not midnight. Submit from your page: ${SITE_URL}${monicaRoutes.me}`;

/** Stages whose deadline has not passed yet. */
export function upcomingDeadlines(now: number = Date.now()): CampaignStage[] {
  return monicaStages.filter((stage) => new Date(stage.endsAt).getTime() > now);
}

/**
 * A VCALENDAR with one event per remaining deadline.
 *
 * DTSTAMP is the stage's own start, not "now", so the file is byte-stable
 * for a given set of stages, as the event calendar is.
 */
export function buildDeadlinesIcs(now: number = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blockfest Africa//Monica deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Monica: The Money Story deadlines",
  ];
  for (const stage of upcomingDeadlines(now)) {
    const end = new Date(stage.endsAt).getTime();
    lines.push(
      "BEGIN:VEVENT",
      `UID:monica-stage-${stage.number}-deadline@blockfestafrica.com`,
      `DTSTAMP:${stamp(stage.startsAt)}`,
      `DTSTART:${stamp(new Date(end - HALF_HOUR).toISOString())}`,
      `DTEND:${stamp(stage.endsAt)}`,
      fold(`SUMMARY:${text(summary(stage))}`),
      fold(`DESCRIPTION:${text(details())}`),
      fold(`URL:${SITE_URL}${monicaRoutes.me}`),
      "TRANSP:TRANSPARENT",
      // The event starts half an hour before the close: -PT2H30M is three
      // hours before the close, -PT23H30M a day before it.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${text(`Monica stage ${stage.number} closes in 3 hours, at 12:00 noon Lagos time`)}`),
      "TRIGGER:-PT2H30M",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${text(`Monica stage ${stage.number} closes tomorrow at 12:00 noon Lagos time`)}`),
      "TRIGGER:-PT23H30M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Google Calendar's add-event link for one deadline, for people who never open files. */
export function googleDeadlineUrl(stage: CampaignStage): string {
  const end = new Date(stage.endsAt).getTime();
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", summary(stage));
  url.searchParams.set("dates", `${stamp(new Date(end - HALF_HOUR).toISOString())}/${stamp(stage.endsAt)}`);
  url.searchParams.set("details", details());
  return url.toString();
}

/** The file's address, absolute, for emails. */
export const deadlinesIcsUrl = () => `${SITE_URL}${monicaRoutes.deadlines}`;
