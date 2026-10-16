/**
 * The Lagos '26 run of show on /schedule.
 *
 * Built from the team's sheet of 16 October. These pin what matters when the
 * sheet changes: the days and venues, every session in order with no overlap,
 * both rooms of the workshop day, the one facilitator still to be named, and
 * that the sheet's working notes never reach a public page.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunOfShow } from "@/components/schedule/run-of-show";
import { blockfest2026Lagos } from "@/lib/events";
import { isSplit, runOfShow2026, sessionLength } from "@/lib/run-of-show-2026";

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

describe("the run of show's data", () => {
  it("has the two public days, on the dates and at the venues the event lists", () => {
    expect(runOfShow2026.map((d) => [d.date, d.venue])).toEqual(
      blockfest2026Lagos.publicDays!.map((d) => [d.date, d.short]),
    );
  });

  it("lists every session in time order, each ending before the next begins", () => {
    for (const day of runOfShow2026) {
      let previousEnd = 0;
      for (const block of day.blocks) {
        const label = `${day.name} ${block.start}`;
        expect(minutes(block.start), label).toBeGreaterThanOrEqual(previousEnd);
        expect(minutes(block.end), label).toBeGreaterThan(minutes(block.start));
        previousEnd = minutes(block.end);
      }
    }
  });

  it("splits the workshop day into the two rooms, four times", () => {
    const splits = runOfShow2026[0].blocks.filter(isSplit);
    expect(splits.map((s) => s.label)).toEqual([
      "Workshop 1",
      "Masterclass 1",
      "Workshop 2",
      "Masterclass 2",
    ]);
    for (const split of splits) {
      expect(split.tracks.map((t) => t.room)).toEqual([
        "Technical Room (Room A)",
        "Non-Technical Room (Room B)",
      ]);
    }
  });

  it("says a duration the way a person would", () => {
    expect(sessionLength("10:40", "11:45")).toBe("1 hr 5 min");
    expect(sessionLength("10:00", "10:05")).toBe("5 min");
    expect(sessionLength("12:35", "13:45")).toBe("1 hr 10 min");
    expect(sessionLength("09:00", "10:00")).toBe("1 hr");
  });

  it("keeps the sheet's working notes out of the page's words", () => {
    const text = JSON.stringify(runOfShow2026);
    for (const internal of [/crowd control/i, /accreditation lanes/i, /food stations/i, /welfare team/i, /shuttle/i, /4,000|3,000/]) {
      expect(text).not.toMatch(internal);
    }
  });
});

describe("the run of show on the page", () => {
  it("gives each day a heading, a venue and a jump link", () => {
    render(<RunOfShow />);
    expect(screen.getByRole("link", { name: /^Day 1 · / }).getAttribute("href")).toBe("#day-1");
    expect(screen.getByRole("link", { name: /^Day 2 · / }).getAttribute("href")).toBe("#day-2");
    expect(screen.getByRole("heading", { level: 2, name: "Workshops & masterclasses" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "The main conference" })).toBeTruthy();
    expect(screen.getByText("Ibis Hotel, Lekki, Lagos")).toBeTruthy();
    expect(screen.getByText("National Art Theatre, Lagos")).toBeTruthy();
  });

  it("shows both rooms side by side with their facilitators", () => {
    render(<RunOfShow />);
    const day = document.getElementById("day-1")!;
    expect(within(day).getAllByText("Technical Room (Room A)")).toHaveLength(4);
    expect(within(day).getAllByText("Non-Technical Room (Room B)")).toHaveLength(4);
    expect(within(day).getByText("Tobiloba Adedeji")).toBeTruthy();
    expect(within(day).getByText("Bibi Eneje")).toBeTruthy();
  });

  it("says plainly that one facilitator is still to be named", () => {
    render(<RunOfShow />);
    expect(screen.getAllByText("To be announced")).toHaveLength(1);
  });

  it("names the moderator and the panelists of each panel", () => {
    render(<RunOfShow />);
    const day = document.getElementById("day-2")!;
    expect(within(day).getAllByText("Moderator:")).toHaveLength(4);
    expect(within(day).getAllByText("Panelists:")).toHaveLength(4);
  });

  it("links a 2026 speaker's name to their profile", () => {
    render(<RunOfShow />);
    expect(screen.getByRole("link", { name: "Tobiloba Adedeji" }).getAttribute("href")).toBe(
      "/speakers/tobiloba-adedeji",
    );
    expect(screen.getByRole("link", { name: "Dr. Maruf Olatunji Alausa" }).getAttribute("href")).toBe(
      "/speakers/dr-tunji-alausa",
    );
    expect(screen.getByRole("link", { name: "Oluwanifemi David Babanumi" }).getAttribute("href")).toBe(
      "/speakers/oluwanifemi-david-babanumi",
    );
  });
});

describe("the schedule page", () => {
  const page = readFileSync(join(process.cwd(), "app/schedule/page.tsx"), "utf8");

  it("no longer says the 2026 schedule is coming", () => {
    expect(page).not.toMatch(/coming soon|coming weeks|ComingSoonNotice/i);
    expect(page).toMatch(/<RunOfShow \/>/);
  });

  it("keeps last year's programme below it", () => {
    expect(page.indexOf("<RunOfShow />")).toBeLessThan(page.indexOf("<PastAgenda />"));
  });
});
