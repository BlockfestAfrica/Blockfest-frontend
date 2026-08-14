/**
 * Tests for the .ics the site serves.
 *
 * RFC 5545 breaks quietly: a calendar with the wrong line endings, an unfolded
 * long line or an unescaped comma does not error, it just fails to import and
 * nobody tells you. These assert the parts of the spec this file implements.
 */

import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, ICS_PATH } from "@/lib/calendar";
import { blockfest2026Lagos } from "@/lib/events";

const ICS = buildIcs();
const LINES = ICS.split("\r\n");

/** RFC 5545 counts octets, not characters, and the copy contains non-ASCII. */
const octets = (line: string) => Buffer.byteLength(line, "utf8");

describe("buildIcs", () => {
  it("is a single complete VCALENDAR wrapping one VEVENT", () => {
    expect(LINES[0]).toBe("BEGIN:VCALENDAR");
    expect(ICS.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(LINES.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(LINES.filter((l) => l === "END:VEVENT")).toHaveLength(1);
  });

  it("declares the version and product id calendars look for", () => {
    expect(ICS).toContain("VERSION:2.0");
    expect(ICS).toMatch(/PRODID:-\/\/.+\/\/.+\/\/EN/);
  });

  it("uses CRLF line endings throughout", () => {
    // A stray bare LF is the classic reason an .ics silently fails to import.
    expect(ICS.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ICS.endsWith("\r\n")).toBe(true);
  });

  it("folds every line to the 75-octet limit", () => {
    for (const line of LINES) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it("starts every continuation line with a space", () => {
    // A folded line that does not begin with whitespace is read as a new
    // property, which is how a description ends up truncated in someone's diary.
    const known = /^(BEGIN|END|VERSION|PRODID|CALSCALE|METHOD|UID|DTSTAMP|DTSTART|DTEND|SUMMARY|DESCRIPTION|LOCATION|URL|STATUS|TRANSP)[:;]/;
    for (const line of LINES) {
      if (line === "") continue;
      if (!known.test(line)) expect(line.startsWith(" ")).toBe(true);
    }
  });

  it("writes timestamps as UTC in the basic format", () => {
    const stamps = ICS.match(/^DT(STAMP|START|END):(.+)$/gm) ?? [];
    expect(stamps.length).toBe(3);
    for (const s of stamps) {
      expect(s).toMatch(/:\d{8}T\d{6}Z$/);
    }
  });

  it("ends the event no earlier than it starts", () => {
    const at = (name: string) =>
      ICS.match(new RegExp(`^${name}:(\\d{8}T\\d{6}Z)`, "m"))?.[1] ?? "";
    expect(at("DTEND") >= at("DTSTART")).toBe(true);
  });

  it("escapes the separators that would otherwise split a property", () => {
    const desc = LINES.filter((l) => l.startsWith("DESCRIPTION:")).join("");
    const body = desc.replace(/^DESCRIPTION:/, "");
    // Any comma or semicolon left in the value must be backslash-escaped.
    for (const m of body.matchAll(/[,;]/g)) {
      expect(body[m.index! - 1]).toBe("\\");
    }
  });

  it("names the venue without repeating the city", () => {
    const location = LINES.filter((l) => l.startsWith("LOCATION:")).join("");
    expect(location).not.toMatch(/Lagos.*\\?,\s*Lagos/);
  });

  it("is byte-stable across calls, so the file can be cached", () => {
    // DTSTAMP is pinned to the event rather than "now"; if that regresses,
    // every build looks like a modified calendar to a subscriber.
    expect(buildIcs()).toBe(ICS);
  });

  it("carries the event identity", () => {
    expect(ICS).toContain(`UID:${blockfest2026Lagos.id}@blockfestafrica.com`);
    expect(ICS).toContain("STATUS:CONFIRMED");
  });
});

describe("googleCalendarUrl", () => {
  const url = new URL(googleCalendarUrl());

  it("points at Google's event template", () => {
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("carries a title, a location and a start/end range", () => {
    expect(url.searchParams.get("text")).toBe(blockfest2026Lagos.name);
    expect(url.searchParams.get("location")).toBeTruthy();
    expect(url.searchParams.get("dates")).toMatch(
      /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/
    );
  });

  it("agrees with the .ics on when the event is", () => {
    const [start, end] = (url.searchParams.get("dates") ?? "").split("/");
    expect(ICS).toContain(`DTSTART:${start}`);
    expect(ICS).toContain(`DTEND:${end}`);
  });
});

describe("ICS_PATH", () => {
  it("is an absolute path ending in .ics", () => {
    expect(ICS_PATH.startsWith("/")).toBe(true);
    expect(ICS_PATH.endsWith(".ics")).toBe(true);
  });
});
