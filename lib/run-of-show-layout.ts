import {
  isSplit,
  type RunBlock,
  type RunDay,
  type RunSession,
  type RunSplit,
  type SessionKind,
} from "@/lib/run-of-show-2026";

/**
 * How a day of the run of show is arranged on /schedule, decided here so the
 * components only draw it.
 *
 * The page used to give every item the same card, so a five-minute "Energy
 * reset with the hosts" weighed as much as a 45-minute panel and Day 2 sat
 * thirteen phone screens down. The owner picked this arrangement by eye from
 * three previews (19 October 2026): one day at a time, each day cut into its
 * parts at its long break, the sessions people come for in full, and every
 * run of supporting items folded into one quiet row.
 */

/** The kinds people come for: always shown in full. Everything else supports them. */
export const PROGRAMME: ReadonlySet<SessionKind> = new Set([
  "welcome",
  "address",
  "keynote",
  "panel",
  "fireside",
  "talk",
  "workshop",
  "masterclass",
]);

export const isSupporting = (block: RunBlock): block is RunSession =>
  !isSplit(block) && !PROGRAMME.has(block.kind);

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export type Row =
  | { type: "programme"; session: RunSession }
  | { type: "split"; split: RunSplit }
  /** Consecutive supporting items, folded into one row. */
  | { type: "quiet"; items: RunSession[] };

export type Segment =
  | { type: "part"; name: string; start: string; end: string; rows: Row[] }
  /** The long break between two parts, drawn between their cards. */
  | { type: "pause"; items: RunSession[] };

/** A day's blocks as rows: programme and two-room slots alone, supporting runs folded. */
export function rowsOf(blocks: RunBlock[]): Row[] {
  const rows: Row[] = [];
  for (const block of blocks) {
    if (isSplit(block)) rows.push({ type: "split", split: block });
    else if (!isSupporting(block)) rows.push({ type: "programme", session: block });
    else {
      const last = rows[rows.length - 1];
      if (last?.type === "quiet") last.items.push(block);
      else rows.push({ type: "quiet", items: [block] });
    }
  }
  return rows;
}

/**
 * A day's parts. A supporting item of half an hour or more between two
 * programme items (lunch, the networking break) is a pause: the cards split
 * there and the pause sits between them as the day's landmark. Parts are
 * named by the clock, and a second part in the same half of the day is named
 * by its start instead, so no two cards share a name.
 */
export function segmentsOf(day: RunDay): Segment[] {
  const { blocks } = day;
  const first = blocks.findIndex((block) => !isSupporting(block));
  const last = blocks.findLastIndex((block) => !isSupporting(block));
  const segments: Segment[] = [];
  const named = new Set<string>();
  let run: RunBlock[] = [];

  const closePart = () => {
    if (!run.length) return;
    const start = run[0].start;
    let name =
      minutes(start) < 12 * 60 ? "Morning" : minutes(start) < 17 * 60 ? "Afternoon" : "Evening";
    if (named.has(name)) name = `From ${start}`;
    named.add(name);
    segments.push({ type: "part", name, start, end: run[run.length - 1].end, rows: rowsOf(run) });
    run = [];
  };

  blocks.forEach((block, i) => {
    const pause =
      isSupporting(block) &&
      i > first &&
      i < last &&
      minutes(block.end) - minutes(block.start) >= 30;
    if (!pause) {
      run.push(block);
      return;
    }
    closePart();
    const previous = segments[segments.length - 1];
    if (previous?.type === "pause") previous.items.push(block);
    else segments.push({ type: "pause", items: [block] });
  });
  closePart();
  return segments;
}

/**
 * The place most of a day happens in, when it is more than half of the day,
 * so the day's head can say it once and the rows only name the exceptions.
 */
export function homePlace(day: RunDay): string | undefined {
  const counts = new Map<string, number>();
  for (const block of day.blocks) {
    if (!isSplit(block) && block.place) {
      counts.set(block.place, (counts.get(block.place) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let most = 0;
  for (const [place, n] of counts) {
    if (n > most) {
      best = place;
      most = n;
    }
  }
  return best && most * 2 > day.blocks.length ? best : undefined;
}

export interface Room {
  /** "room-2": the filter's value. */
  key: string;
  /** "Room 2". */
  number: string;
  /** "Technical". */
  name: string;
}

/** The sheet's "Technical Room (Room 2)" as Room 2 · Technical. */
export function roomOf(full: string): Room {
  const match = /^(.+?)\s+Room\s+\((Room\s+\d+)\)$/i.exec(full);
  if (!match) {
    return { key: full.toLowerCase().replace(/[^a-z0-9]+/g, "-"), number: full, name: "" };
  }
  const kind = match[1].toLowerCase();
  return {
    key: match[2].toLowerCase().replace(/\s+/g, "-"),
    number: match[2],
    name: kind.charAt(0).toUpperCase() + kind.slice(1),
  };
}

export const roomNumber = (room: Room) => Number(/\d+/.exec(room.number)?.[0] ?? 0);

/** The rooms of a day's two-room slots, in room order (the sheet lists Room 2 first). */
export function roomsOf(splits: RunSplit[]): Room[] {
  const rooms = new Map<string, Room>();
  for (const split of splits) {
    for (const track of split.tracks) {
      const room = roomOf(track.room);
      rooms.set(room.key, room);
    }
  }
  return [...rooms.values()].sort((a, b) => roomNumber(a) - roomNumber(b));
}

/** A supporting item by a name that stands on its own: "Monica" alone does not. */
export const quietName = (s: RunSession) =>
  s.label && s.title.split(/\s+/).length <= 2 ? `${s.label}: ${s.title}` : s.title;

/** True when an item's label is already in its title ("Lunch" in "Lunch break and networking"). */
export const labelSaid = (s: RunSession) =>
  !s.label || s.title.toLowerCase().includes(s.label.toLowerCase());

/** "2026-10-23" for the date it is in Lagos at that instant. */
const lagosDate = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

/**
 * Which day to open first: the day it is in Lagos, while the event is on.
 * On 23 October the page opens on the main conference; on any other date it
 * opens on Day 1. -1 when today is not one of the days.
 */
export function dayIndexOn(dates: readonly string[], now: Date): number {
  return dates.indexOf(lagosDate(now));
}
