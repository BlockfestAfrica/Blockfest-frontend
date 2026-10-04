/**
 * The morning list for owners: what needs a person on the campaign today.
 *
 * The owner asked for the campaign to be proactive with every send to
 * creators still a button a person presses. So a scheduled job emails owners
 * what is due. These walk real moments of the stage 3 week through the pure
 * decision and pin each line.
 */

import { describe, expect, it } from "vitest";
import { dueItems, type DueFacts } from "@/lib/admin/due-today";

const at = (iso: string) => new Date(iso).getTime();

const W3 = {
  id: "c3",
  weekNo: 3,
  status: "active" as const,
  startsAt: "2026-10-05T00:00:00+01:00",
  endsAt: "2026-10-10T12:00:00+01:00",
};
const W4 = {
  id: "c4",
  weekNo: 4,
  status: "draft" as const,
  startsAt: "2026-10-12T00:00:00+01:00",
  endsAt: "2026-10-17T12:00:00+01:00",
};

const facts = (over: Partial<DueFacts> = {}): DueFacts => ({
  challenges: [W3, { ...W4, status: "active" }],
  announced: ["c3"],
  reminders: { c3: { sent: [], waiting: 87 } },
  pendingOverADay: 0,
  recorded: [1, 2, 3],
  published: ["2:creator_of_week", "2:community_favourite"],
  rounds: [],
  ...over,
});

const texts = (f: DueFacts, when: string) => dueItems(f, at(when)).map((i) => i.text);

describe("the morning list", () => {
  it("says nothing on a quiet day", () => {
    expect(texts(facts(), "2026-10-06T08:00:00+01:00")).toEqual([]);
  });

  it("asks for the reminder the evening before a noon close", () => {
    expect(texts(facts(), "2026-10-09T19:00:00+01:00")).toEqual([
      "Send the week 3 reminder: it closes tomorrow at 12:00 noon, and 87 creators have nothing in.",
    ]);
  });

  it("asks for the last call on the morning, six hours after the first", () => {
    const f = facts({
      reminders: {
        c3: { sent: [{ number: 1, at: "2026-10-09T18:00:00.000Z", sent: 87, failed: 0, finished: true }], waiting: 40 },
      },
    });
    const items = dueItems(f, at("2026-10-10T08:00:00+01:00"));
    expect(items.map((i) => i.text)).toEqual([
      "Send the week 3 last call: it closes today at 12:00 noon, and 40 creators have nothing in.",
    ]);
    expect(items[0].href).toBe("/admin/campaign#stages");
  });

  it("does not ask for a reminder days early, or once both have gone, or with everyone in", () => {
    expect(texts(facts(), "2026-10-07T08:00:00+01:00")).toEqual([]);
    const both = [
      { number: 1, at: "2026-10-09T18:00:00.000Z", sent: 87, failed: 0, finished: true },
      { number: 2, at: "2026-10-10T06:00:00.000Z", sent: 40, failed: 0, finished: true },
    ];
    expect(texts(facts({ reminders: { c3: { sent: both, waiting: 10 } } }), "2026-10-10T09:00:00+01:00")).toEqual([]);
    expect(texts(facts({ reminders: { c3: { sent: [], waiting: 0 } } }), "2026-10-09T19:00:00+01:00")).toEqual([]);
  });

  it("asks to announce a live week nobody has been told about", () => {
    expect(texts(facts({ announced: [] }), "2026-10-05T08:00:00+01:00")).toEqual([
      "Announce week 3 to creators: it is live and nobody has been told.",
    ]);
  });

  it("names submissions that have waited over a day", () => {
    expect(texts(facts({ pendingOverADay: 1 }), "2026-10-06T08:00:00+01:00")).toEqual([
      "1 submission has waited over a day for review.",
    ]);
  });

  it("lists results-day work on the Sunday, linked to that week, and says the record is today only", () => {
    const f = facts({ recorded: [1, 2] });
    const items = dueItems(f, at("2026-10-11T08:00:00+01:00"));
    expect(items.map((i) => i.text)).toEqual([
      "Record the week 3 standings today, before midnight: after that they cannot be recorded.",
      "Announce week 3's Creator of the Week.",
      "Open the week 3 Community Favourite vote.",
    ]);
    expect(items.every((i) => i.href === "/admin/winners?week=3")).toBe(true);
  });

  it("after its Sunday, says once that an unrecorded week needs fixing, not three refused actions", () => {
    const f = facts({ recorded: [1, 2] });
    expect(texts(f, "2026-10-12T08:00:00+01:00").filter((t) => t.includes("week 3") || t.includes("Week 3"))).toEqual([
      "Week 3's standings were never recorded, so its awards cannot be announced or voted on from the console. They need fixing by hand.",
    ]);
  });

  it("follows the vote: tell the creators, then review, then announce", () => {
    const round = { weekNo: 3, opensAt: "2026-10-11T09:00:00.000Z", closesAt: "2026-10-13T20:00:00.000Z" };
    const base = facts({ published: ["3:creator_of_week"] });
    expect(
      texts({ ...base, rounds: [{ ...round, status: "open", reviewed: false, told: false }] }, "2026-10-12T08:00:00+01:00"),
    ).toContain("Tell the creators the week 3 vote is open: it closes Tuesday, 13 October at 21:00.");
    expect(
      texts({ ...base, rounds: [{ ...round, status: "closed", reviewed: false, told: true }] }, "2026-10-14T08:00:00+01:00"),
    ).toContain("Review the week 3 vote and announce the Community Favourite: voting has closed.");
    expect(
      texts({ ...base, rounds: [{ ...round, status: "closed", reviewed: true, told: true }] }, "2026-10-14T08:00:00+01:00"),
    ).toContain("Announce the week 3 Community Favourite: the vote is reviewed.");
    expect(
      texts(
        { ...base, published: ["3:creator_of_week", "3:community_favourite"], rounds: [{ ...round, status: "published", reviewed: true, told: true }] },
        "2026-10-14T08:00:00+01:00",
      ).filter((t) => t.includes("vote")),
    ).toEqual([]);
  });

  it("flags a week still in draft after its start, when nobody can enter", () => {
    expect(texts(facts({ challenges: [W3, W4] }), "2026-10-12T08:00:00+01:00")).toContain(
      "Week 4 started Monday 12 October and is still a draft, so creators cannot enter: set it active, then announce it.",
    );
  });

  it("warns two days ahead that next week is still a draft", () => {
    expect(texts(facts({ challenges: [W3, W4] }), "2026-10-10T18:00:00+01:00")).toContain(
      "Week 4 starts Monday 12 October and is still a draft: write it and set it active.",
    );
    expect(texts(facts({ challenges: [W3, W4] }), "2026-10-08T08:00:00+01:00").join(" ")).not.toContain("still a draft");
  });
});
