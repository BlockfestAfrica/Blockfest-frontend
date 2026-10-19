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
import { renderToStaticMarkup } from "react-dom/server";
import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_SCRIPT, RunOfShow } from "@/components/schedule/run-of-show";
import { PROGRAMME } from "@/lib/run-of-show-layout";
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
        "Technical Room (Room 2)",
        "Non-Technical Room (Room 1)",
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

/*
 * The switcher opens on the day it is in Lagos while the event is on, so
 * every render here runs on a pinned, ordinary day unless a test sets its
 * own: a suite run on 23 October would otherwise open on Day 2.
 */
const ORDINARY_DAY = new Date("2026-10-19T10:00:00+01:00");

beforeEach(() => {
  vi.useFakeTimers({ now: ORDINARY_DAY, toFake: ["Date"] });
  // jsdom draws nothing, so it has no scrolling to do.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

/** A day's panel. Its id is not the hash, so the browser never jumps to a day itself. */
const panel = (id: string) => document.getElementById(`${id}-panel`)!;
const tab = (day: 1 | 2) => screen.getByRole("tab", { name: new RegExp(`^Day ${day},`) });

describe("the day switcher", () => {
  it("opens on Day 1, with a tab per day, and keeps Day 2 in the page", () => {
    render(<RunOfShow />);
    expect(tab(1).getAttribute("aria-selected")).toBe("true");
    expect(tab(2).getAttribute("aria-selected")).toBe("false");
    expect(tab(2).getAttribute("aria-controls")).toBe("day-2-panel");
    expect(document.getElementById("day-2")).toBeNull();
    expect(panel("day-1").hidden).toBe(false);
    expect(panel("day-2").hasAttribute("hidden")).toBe(true);
    // Both days are there for crawlers and find-in-page, each under its own h2.
    expect(
      screen.getByRole("heading", { level: 2, name: "Workshops & masterclasses" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "The main conference", hidden: true }),
    ).toBeTruthy();
    expect(screen.getByText("Ibis Hotel, Lekki, Lagos")).toBeTruthy();
    expect(screen.getByText("National Art Theatre, Lagos")).toBeTruthy();
  });

  it("shows Day 2 on a tap and writes it in the address, without adding history", () => {
    render(<RunOfShow />);
    const before = window.history.length;
    fireEvent.click(tab(2));
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(panel("day-2").hidden).toBe(false);
    expect(panel("day-1").hasAttribute("hidden")).toBe(true);
    expect(window.location.hash).toBe("#day-2");
    expect(window.history.length).toBe(before);
    // A tap on a tab changes the day where the reader is; it does not move them.
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps the hidden day out of the accessibility tree once the page runs, and in it without JavaScript", () => {
    render(<RunOfShow />);
    expect(panel("day-2").getAttribute("aria-hidden")).toBe("true");
    expect(panel("day-2").hasAttribute("tabindex")).toBe(false);
    expect(panel("day-1").hasAttribute("aria-hidden")).toBe(false);
    fireEvent.click(tab(2));
    expect(panel("day-2").hasAttribute("aria-hidden")).toBe(false);
    expect(panel("day-1").getAttribute("aria-hidden")).toBe("true");
    // The server's markup, which is all a reader without JavaScript gets, hides neither.
    expect(renderToStaticMarkup(<RunOfShow />)).not.toMatch(/aria-hidden="true"[^>]*data-schedule-panel|data-schedule-panel[^>]*aria-hidden/);
  });

  it("keeps the hidden day findable with find-in-page, and shows it on a match", () => {
    render(<RunOfShow />);
    expect(panel("day-2").getAttribute("hidden")).toBe("until-found");
    act(() => {
      panel("day-2").dispatchEvent(new Event("beforematch"));
    });
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(panel("day-1").getAttribute("hidden")).toBe("until-found");
    // So a share or a reload opens the day the match was found in.
    expect(window.location.hash).toBe("#day-2");
  });

  it("moves between the days with the arrow keys, Home and End", () => {
    render(<RunOfShow />);
    fireEvent.keyDown(tab(1), { key: "ArrowRight" });
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(2));
    fireEvent.keyDown(tab(2), { key: "ArrowRight" });
    expect(tab(1).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab(1), { key: "End" });
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab(2), { key: "Home" });
    expect(tab(1).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab(1), { key: "ArrowLeft" });
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab(2), { key: "ArrowLeft" });
    expect(tab(1).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(1));
    // Only the chosen tab is in the Tab order.
    expect(tab(1).tabIndex).toBe(0);
    expect(tab(2).tabIndex).toBe(-1);
  });

  it("opens the day a link names, /schedule#day-2, and scrolls to it", () => {
    window.history.replaceState(null, "", "/schedule#day-2");
    render(<RunOfShow />);
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(panel("day-2").hidden).toBe(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(panel("day-2"));
  });

  it("leaves a reload or a Back where the browser puts it, once it has scrolled for that entry", () => {
    // The entry already scrolled once: this is the same page again.
    window.history.replaceState({ scheduleDayScrolled: true }, "", "/schedule#day-2");
    render(<RunOfShow />);
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("marks the entry it scrolled for, keeping what else the entry holds", () => {
    window.history.replaceState({ kept: 1 }, "", "/schedule#day-2");
    render(<RunOfShow />);
    expect(window.history.state).toEqual({ kept: 1, scheduleDayScrolled: true });
  });

  it("follows an in-page link to a day after the page has loaded", () => {
    render(<RunOfShow />);
    act(() => {
      window.history.pushState(null, "", "#day-2");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("opens on Day 1, and does not break, when the hash is malformed or names no day", () => {
    for (const hash of ["#%", "#day-2%", "#%E0%A4%A", "#nope"]) {
      window.history.replaceState(null, "", `/schedule${hash}`);
      const { unmount } = render(<RunOfShow />);
      expect(tab(1).getAttribute("aria-selected"), hash).toBe("true");
      unmount();
    }
  });

  it("links the end of each day to the other one", () => {
    render(<RunOfShow />);
    const next = within(panel("day-1")).getByRole("link", { name: /Next: Day 2/ });
    expect(next.getAttribute("href")).toBe("#day-2");
    // One text node, so Chrome reads "Next: Day 2", not "Next:Day 2".
    const line = next.querySelector("span > span")!;
    expect(line.childNodes).toHaveLength(1);
    expect(line.textContent).toBe("Next: Day 2 · Fri 23 Oct");
    fireEvent.click(next);
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    expect(window.location.hash).toBe("#day-2");
    expect(document.activeElement).toBe(tab(2));
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(panel("day-2"));
    const back = within(panel("day-2")).getByRole("link", { name: /Back to Day 1/ });
    expect(back.getAttribute("href")).toBe("#day-1");
  });

  it("lets a Cmd, Ctrl or middle click on the foot link open it the browser's way", () => {
    render(<RunOfShow />);
    const next = within(panel("day-1")).getByRole("link", { name: /Next: Day 2/ });
    for (const click of [{ metaKey: true }, { ctrlKey: true }, { button: 1 }]) {
      const event = createEvent.click(next, click);
      fireEvent(next, event);
      expect(event.defaultPrevented, JSON.stringify(click)).toBe(false);
      expect(tab(1).getAttribute("aria-selected")).toBe("true");
    }
  });
});

describe("which day opens", () => {
  const on = (iso: string) => vi.setSystemTime(new Date(iso));

  it("opens on the main conference on the Friday itself", () => {
    on("2026-10-23T07:30:00+01:00");
    render(<RunOfShow />);
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
    // Opening on the day is not a choice the visitor made: the address stays as it was.
    expect(window.location.hash).toBe("");
  });

  it("opens on the Friday from just after midnight in Lagos, even when it is still Thursday in UTC", () => {
    on("2026-10-22T23:30:00Z"); // 00:30 on Friday in Lagos
    render(<RunOfShow />);
    expect(tab(2).getAttribute("aria-selected")).toBe("true");
  });

  it("opens on Day 1 on the Thursday, before the event and after it", () => {
    for (const iso of ["2026-10-22T09:00:00+01:00", "2026-10-21T12:00:00+01:00", "2026-10-24T10:00:00+01:00"]) {
      on(iso);
      const { unmount } = render(<RunOfShow />);
      expect(tab(1).getAttribute("aria-selected"), iso).toBe("true");
      unmount();
    }
  });

  it("lets a link to Day 1 win on the Friday", () => {
    on("2026-10-23T09:00:00+01:00");
    window.history.replaceState(null, "", "/schedule#day-1");
    render(<RunOfShow />);
    expect(tab(1).getAttribute("aria-selected")).toBe("true");
  });
});

describe("a day on the page", () => {
  it("cuts each day at its long break into a Morning and an Afternoon card", () => {
    render(<RunOfShow />);
    for (const [id, morning, afternoon, pause] of [
      ["day-1", "10:00 to 12:35", "13:20 to 15:30", "Networking break"],
      ["day-2", "07:00 to 12:35", "13:45 to 17:00", "Lunch break and networking"],
    ]) {
      const day = panel(id);
      expect(within(day).getByText("Morning").nextElementSibling?.textContent, id).toBe(morning);
      expect(within(day).getByText("Afternoon").nextElementSibling?.textContent, id).toBe(afternoon);
      expect(within(day).getByText(pause), id).toBeTruthy();
    }
  });

  it("says the hall once for the day, and only names the places that differ", () => {
    render(<RunOfShow />);
    const day = panel("day-2");
    expect(within(day).getAllByText("All sessions in the Main Hall unless noted.")).toHaveLength(1);
    expect(within(day).queryByText("Main Hall")).toBeNull();
    expect(within(day).getAllByText("Entry / Foyer").length).toBeGreaterThan(0);
    expect(within(day).getByText("Foyer + Outdoor")).toBeTruthy();
    // Day 1 has no hall to name.
    expect(within(panel("day-1")).queryByText(/unless noted/)).toBeNull();
  });

  it("folds a run of short host slots into one row that opens, and leaves a lone slot as a plain line", () => {
    render(<RunOfShow />);
    const day = panel("day-2");
    const closing = within(day)
      .getByText("Mascot gadget giveaway · Closing address & farewell · Photos and final networking")
      .closest("details")!;
    expect(closing).toBeTruthy();
    expect(closing.open).toBe(false);
    // Inside the fold, each with its own time and people.
    expect(within(closing).getByText(/Xeus the Great/)).toBeTruthy();
    expect(closing.querySelectorAll("ol > li")).toHaveLength(3);
    // "Internet takeover" has nothing more to say, so it is a line, not a fold.
    expect(within(day).getByText("Internet takeover").closest("details")).toBeNull();
  });

  it("shows the two rooms side by side, says once that they run together, and narrows to the room picked", () => {
    render(<RunOfShow />);
    const day = panel("day-1");
    expect(within(day).getAllByText(/two rooms run at the same time/i)).toHaveLength(1);
    expect(within(day).getAllByText("Room 1 · Non-technical")).toHaveLength(4);
    expect(within(day).getAllByText("Room 2 · Technical")).toHaveLength(4);

    const brandLab = within(day).getByText("The Brand Lab").closest("li")!;
    const payments = within(day).getByText("Prompt to Payments: Stablecoin Edition").closest("li")!;
    fireEvent.click(within(day).getByRole("radio", { name: /Room 2/ }));
    expect(brandLab.hidden).toBe(true);
    expect(payments.hidden).toBe(false);
    fireEvent.click(within(day).getByRole("radio", { name: /Both rooms/ }));
    expect(brandLab.hidden).toBe(false);
    expect(within(day).getByText("Tobiloba Adedeji")).toBeTruthy();
    expect(within(day).getByText("Bibi Eneje")).toBeTruthy();
  });

  it("says plainly that a facilitator and a speaker are still to be named", () => {
    render(<RunOfShow />);
    expect(screen.getAllByText("To be announced")).toHaveLength(2);
  });

  it("names the moderator and the panelists of each panel", () => {
    render(<RunOfShow />);
    const day = panel("day-2");
    expect(within(day).getAllByText("Moderator:")).toHaveLength(4);
    expect(within(day).getAllByText("Panelists:")).toHaveLength(4);
  });

  it("gives every session a heading of its own, and the folded host slots none", () => {
    render(<RunOfShow />);
    for (const day of runOfShow2026) {
      const expected = day.blocks.reduce(
        (n, block) => n + (isSplit(block) ? block.tracks.length : PROGRAMME.has(block.kind) ? 1 : 0),
        0,
      );
      expect(panel(day.id).querySelectorAll("h3"), day.id).toHaveLength(expected);
    }
  });

  it("links a 2026 speaker's name to their profile", () => {
    render(<RunOfShow />);
    const link = (name: string) => screen.getByRole("link", { name, hidden: true }).getAttribute("href");
    expect(link("Tobiloba Adedeji")).toBe("/speakers/tobiloba-adedeji");
    expect(link("Dr. Maruf Olatunji Alausa")).toBe("/speakers/dr-tunji-alausa");
    expect(link("Oluwanifemi David Babanumi")).toBe("/speakers/oluwanifemi-david-babanumi");
    // A name inside a comma-separated panel list links too.
    expect(link("Kayode Oluwatimilehin")).toBe("/speakers/kayode-oluwatimilehin");
    // A name with no profile stays plain text. The placeholder never gets a
    // profile, so a speaker PR landing cannot flip this the way it did when
    // this test pinned a real name that was still on its way.
    expect(screen.getAllByText("To be announced").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "To be announced", hidden: true })).toBeNull();
  });

  it("loses nothing from the sheet: every time, title, label, detail, person, place and room is in its own day", () => {
    render(<RunOfShow />);
    const missing: string[] = [];
    for (const day of runOfShow2026) {
      const text = (panel(day.id).textContent ?? "").replace(/\s+/g, " ");
      const need = (value: string | undefined, where: string) => {
        if (value && !text.includes(value)) missing.push(`${where}: ${value}`);
      };
      // Nothing in a day is hidden but the folds, which open in place (and the
      // date line the tab stands in for, which only shows without JavaScript).
      const hiddenInside = [...panel(day.id).querySelectorAll("[hidden]:not([data-schedule-nojs])")];
      expect(hiddenInside, day.id).toEqual([]);
      for (const block of day.blocks) {
        const at = `${day.id} ${block.start}`;
        need(block.start, at);
        need(block.end, at);
        if (isSplit(block)) {
          need(block.label, at);
          for (const track of block.tracks) {
            need(track.title, at);
            for (const line of track.people) {
              need(`${line.label}:`, at);
              need(line.names, at);
            }
          }
        } else {
          need(block.title, at);
          // A label the title already says ("Lunch" in "Lunch break...") is dropped on purpose.
          if (block.label && !block.title.toLowerCase().includes(block.label.toLowerCase())) need(block.label, at);
          need(block.detail, at);
          need(block.place === "Main Hall" ? undefined : block.place, at);
          for (const line of block.people ?? []) {
            need(`${line.label}:`, at);
            need(line.names, at);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("without JavaScript", () => {
  it("shows both days, each with its date, and none of the controls", () => {
    const html = renderToStaticMarkup(<RunOfShow />);
    expect(html).toContain(`<noscript>${NO_SCRIPT}</noscript>`);
    // The style beats Tailwind's [hidden] rule only from a layer before base.
    expect(NO_SCRIPT).toMatch(/@layer theme\{\[data-schedule-panel\]\[hidden\]/);
    expect(NO_SCRIPT).toContain("[data-schedule-js]{display:none!important}");
    // Day 2 is in the markup, hidden until a tap, and so is each day's date line.
    expect(html).toMatch(/id="day-2-panel" role="tabpanel"[^>]*hidden=""/);
    expect(html).toContain("The main conference");
    expect(html.match(/<p[^>]*data-schedule-nojs/g)).toHaveLength(2);
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
