/**
 * The stage deadlines as a calendar, so a phone says it, not an inbox.
 *
 * A creator read "12:00" as midnight and missed stage 2. The deadlines are
 * now a calendar file with alerts a day and three hours before, linked from
 * the stage announcement, /me and the stage card.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildDeadlinesIcs, googleDeadlineUrl, upcomingDeadlines } from "@/lib/stage-calendar";
import { monicaStages } from "@/lib/campaigns";
import { challengeLiveEmail } from "@/lib/email/templates";
import { AddToCalendar } from "@/components/campaigns/add-to-calendar";

const between2and3 = new Date("2026-10-04T10:00:00+01:00").getTime();

describe("the deadlines file", () => {
  const ics = buildDeadlinesIcs(between2and3);

  it("holds only the deadlines still ahead, each ending at the close", () => {
    expect(upcomingDeadlines(between2and3).map((s) => s.number)).toEqual([3, 4]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    // Stage 3 closes Saturday 10 October, 12:00 Lagos = 11:00 UTC.
    expect(ics).toContain("DTEND:20261010T110000Z");
    expect(ics).toContain("SUMMARY:Monica stage 3 closes (12:00 noon\\, Lagos)");
  });

  it("alerts three hours and a day before, timed from the start, three hours first", () => {
    // The event starts half an hour before the close; Outlook ignores
    // RELATED=END and keeps only the first alert.
    expect(ics).not.toContain("RELATED=END");
    expect(ics.match(/TRIGGER:-PT2H30M/g)).toHaveLength(2);
    expect(ics.match(/TRIGGER:-PT23H30M/g)).toHaveLength(2);
    const first = ics.slice(ics.indexOf("BEGIN:VALARM"));
    expect(first.indexOf("TRIGGER:-PT2H30M")).toBeLessThan(first.indexOf("TRIGGER:-PT23H30M"));
  });

  it("is a well-formed calendar: CRLF lines, none over 75 characters", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("is empty of events once every deadline has passed", () => {
    expect(buildDeadlinesIcs(new Date("2026-10-20T00:00:00Z").getTime())).not.toContain("BEGIN:VEVENT");
  });
});

describe("the Google Calendar link", () => {
  it("adds the half hour before a deadline", () => {
    const url = new URL(googleDeadlineUrl(monicaStages[2]));
    expect(url.searchParams.get("dates")).toBe("20261010T103000Z/20261010T110000Z");
    expect(url.searchParams.get("details")).toMatch(/midday, not midnight/);
  });
});

describe("where the links show", () => {
  it("on /me and the stage card", () => {
    render(<AddToCalendar weekNo={3} />);
    expect(screen.getByRole("link", { name: "Google Calendar" }).getAttribute("href")).toMatch(/^https:\/\/calendar\.google\.com/);
    expect(screen.getByRole("link", { name: "Apple or Outlook" }).getAttribute("href")).toBe(
      "/campaigns/monica-money-story/deadlines.ics",
    );
  });

  it("in the stage announcement", () => {
    const email = challengeLiveEmail({
      to: "ada@e.com",
      fullName: "Ada Obi",
      weekNo: 3,
      title: "T",
      question: null,
      brief: "B",
      basePoints: 100,
      closesAtLagos: "Saturday, 10 October at 12:00 noon",
      pageUrl: "https://blockfestafrica.com/campaigns/monica-money-story/me",
      calendar: { google: "https://calendar.google.com/x?a=1&b=2", ics: "https://blockfestafrica.com/campaigns/monica-money-story/deadlines.ics" },
    });
    expect(email.text).toContain("Google Calendar: https://calendar.google.com/x?a=1&b=2");
    expect(email.html).toContain('href="https://calendar.google.com/x?a=1&amp;b=2"');
    expect(email.html).toContain("reminds you three hours before the close, and in Apple Calendar a day before too");
    // The reminder claim belongs to the file, not the Google link.
    expect(email.text).not.toMatch(/so your phone reminds you/);
    expect(email.text).toContain("The calendar file reminds you three hours before the close");
  });
});
