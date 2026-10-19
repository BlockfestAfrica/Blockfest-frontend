/**
 * How a day of the run of show is arranged (lib/run-of-show-layout.ts),
 * including the cases today's sheet does not have yet: the sheet changes and
 * the arrangement must still hold.
 */
import { describe, expect, it } from "vitest";
import {
  dayIndexOn,
  homePlace,
  labelSaid,
  quietName,
  roomOf,
  roomsOf,
  rowsOf,
  segmentsOf,
} from "@/lib/run-of-show-layout";
import { runOfShow2026, type RunDay, type RunSession, type RunSplit } from "@/lib/run-of-show-2026";

const s = (start: string, end: string, kind: RunSession["kind"], title: string, extra: Partial<RunSession> = {}): RunSession => ({
  start,
  end,
  kind,
  title,
  ...extra,
});
const day = (blocks: RunDay["blocks"]): RunDay => ({
  id: "day-x",
  name: "Day X",
  date: "2026-10-23",
  theme: "Test",
  venue: "Somewhere",
  blocks,
});

describe("rows", () => {
  it("folds consecutive supporting items into one row and keeps sessions apart", () => {
    const rows = rowsOf([
      s("09:00", "09:30", "keynote", "A keynote"),
      s("09:30", "09:35", "host", "Energy reset"),
      s("09:35", "09:40", "entertainment", "Music"),
      s("09:40", "10:00", "panel", "A panel"),
      s("10:00", "10:05", "host", "Another reset"),
    ]);
    expect(rows.map((r) => (r.type === "quiet" ? r.items.map((i) => i.title) : r.type))).toEqual([
      "programme",
      ["Energy reset", "Music"],
      "programme",
      ["Another reset"],
    ]);
  });
});

describe("parts of a day", () => {
  it("cuts the real days at their long breaks", () => {
    const shape = (d: RunDay) =>
      segmentsOf(d).map((seg) =>
        seg.type === "part" ? `${seg.name} ${seg.start}-${seg.end}` : `pause ${seg.items.map((i) => i.title).join("+")}`,
      );
    expect(shape(runOfShow2026[0])).toEqual([
      "Morning 10:00-12:35",
      "pause Networking break",
      "Afternoon 13:20-15:30",
    ]);
    expect(shape(runOfShow2026[1])).toEqual([
      "Morning 07:00-12:35",
      "pause Lunch break and networking",
      "Afternoon 13:45-17:00",
    ]);
  });

  it("never cuts at a long item before the first session or after the last one", () => {
    const segments = segmentsOf(
      day([
        s("07:00", "08:00", "logistics", "Doors open"),
        s("08:00", "09:00", "keynote", "Keynote"),
        s("09:00", "10:00", "networking", "Networking"),
      ]),
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "part", name: "Morning", start: "07:00", end: "10:00" });
  });

  it("names a second part in the same half of the day by its start, so no two cards share a name", () => {
    const names = segmentsOf(
      day([
        s("12:00", "12:30", "talk", "A"),
        s("12:30", "13:00", "break", "Break one"),
        s("13:00", "13:30", "talk", "B"),
        s("13:30", "14:00", "break", "Break two"),
        s("14:00", "14:30", "talk", "C"),
      ]),
    ).flatMap((seg) => (seg.type === "part" ? [seg.name] : []));
    expect(names).toEqual(["Afternoon", "From 13:00", "From 14:00"]);
  });
});

describe("the day's hall", () => {
  it("is the place most of the day happens in", () => {
    expect(homePlace(runOfShow2026[1])).toBe("Main Hall");
  });

  it("is nothing when no place holds most of the day, or the sheet names none", () => {
    expect(homePlace(runOfShow2026[0])).toBeUndefined();
    expect(
      homePlace(
        day([
          s("09:00", "10:00", "talk", "A", { place: "Hall A" }),
          s("10:00", "11:00", "talk", "B", { place: "Hall B" }),
          s("11:00", "12:00", "talk", "C"),
        ]),
      ),
    ).toBeUndefined();
  });
});

describe("rooms", () => {
  it("reads the sheet's room names as a number and a kind, in room order", () => {
    expect(roomOf("Technical Room (Room 2)")).toEqual({ key: "room-2", number: "Room 2", name: "Technical" });
    expect(roomOf("Non-Technical Room (Room 1)")).toEqual({
      key: "room-1",
      number: "Room 1",
      name: "Non-technical",
    });
    const splits = runOfShow2026[0].blocks.filter((b): b is RunSplit => "tracks" in b);
    expect(roomsOf(splits).map((r) => r.number)).toEqual(["Room 1", "Room 2"]);
  });

  it("keeps a room name it cannot read as it is", () => {
    expect(roomOf("The Garden")).toEqual({ key: "the-garden", number: "The Garden", name: "" });
  });
});

describe("names of supporting items", () => {
  it("borrow their label when the title cannot stand alone, and drop a label the title already says", () => {
    expect(quietName(s("10:55", "11:00", "sponsor", "Monica", { label: "Sponsor spotlight" }))).toBe(
      "Sponsor spotlight: Monica",
    );
    expect(quietName(s("12:00", "12:05", "host", "Internet takeover"))).toBe("Internet takeover");
    expect(labelSaid(s("12:35", "13:45", "break", "Lunch break and networking", { label: "Lunch" }))).toBe(true);
    expect(labelSaid(s("16:50", "17:00", "logistics", "Photos and final networking", { label: "Exit" }))).toBe(false);
  });
});

describe("the day that opens first", () => {
  const dates = runOfShow2026.map((d) => d.date);

  it("is the day it is in Lagos while the event is on", () => {
    expect(dayIndexOn(dates, new Date("2026-10-22T08:00:00+01:00"))).toBe(0);
    expect(dayIndexOn(dates, new Date("2026-10-23T08:00:00+01:00"))).toBe(1);
  });

  it("turns over at midnight in Lagos, not in UTC", () => {
    expect(dayIndexOn(dates, new Date("2026-10-22T22:59:00Z"))).toBe(0); // 23:59 Thursday in Lagos
    expect(dayIndexOn(dates, new Date("2026-10-22T23:00:00Z"))).toBe(1); // 00:00 Friday in Lagos
  });

  it("is none before or after the event", () => {
    expect(dayIndexOn(dates, new Date("2026-10-21T12:00:00+01:00"))).toBe(-1);
    expect(dayIndexOn(dates, new Date("2026-10-24T12:00:00+01:00"))).toBe(-1);
  });
});
