import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * "Have I already given them this?"
 *
 * The award form showed nothing that had been given before, so a second
 * quality bonus for the same post looked exactly like a first one, and the
 * only record anyone could consult was their own memory. These pin the parts
 * of the People screen that now answer it. The query behind them is exercised
 * against the real schema in __tests__/integration/decided-and-awards.test.ts.
 *
 * Comments are stripped first: prose explaining a rule has been read as the
 * rule by tests like this before.
 */

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const table = codeOnly(
  readFileSync(join(process.cwd(), "components/admin/participants-table.tsx"), "utf8"),
);

const awardRow = table.slice(table.indexOf("function AwardRow("));

describe("the award panel", () => {
  it("is handed what this creator was already given", () => {
    expect(table).toMatch(/awards=\{selected\.awards\}/);
  });

  it("lists it before the form, so it is read before a number is typed", () => {
    const history = awardRow.indexOf("Already given");
    const form = awardRow.indexOf('id="award-source"');
    expect(history, "the history is rendered").toBeGreaterThan(-1);
    expect(history).toBeLessThan(form);
  });

  it("warns before Apply when this kind was already given", () => {
    const warning = awardRow.indexOf('role="status"');
    const apply = awardRow.indexOf('"Apply"');
    expect(warning, "the warning is rendered").toBeGreaterThan(-1);
    expect(warning).toBeLessThan(apply);
    // Counted net of take-backs, so a bonus given and taken back is not a repeat.
    expect(awardRow).toMatch(/standing\s*>\s*0/);
  });

  it("warns rather than blocks, because two bonuses for two pieces of work are legitimate", () => {
    const disabled = awardRow.slice(awardRow.indexOf("disabled={"), awardRow.indexOf('"Apply"'));
    expect(disabled).not.toContain("standing");
    expect(disabled).not.toContain("sameKind");
  });

  it("marks an entry whose one engagement bonus is used, even after a take-back", () => {
    // Used means a positive row exists. The net says nothing about that: +40
    // then -40 nets to zero and the entry still cannot take another bonus.
    expect(awardRow).toMatch(/engagementUsed = \(id: string\) =>[\s\S]{0,200}a\.points > 0/);
    expect(awardRow).toContain("bonus used, taken back");
  });

  it("never advises taking a bonus back to make room for another", () => {
    expect(awardRow).not.toMatch(/take (that|the old) one back first/i);
    const route = readFileSync(join(process.cwd(), "app/api/admin/award/route.ts"), "utf8");
    expect(route).not.toMatch(/Take the old one back first/);
  });

  it("stays quiet while a take-back is being typed", () => {
    expect(awardRow).toMatch(/const takingBack = value < 0/);
    expect(awardRow).toMatch(/!takingBack && \(warnEngagement \|\| warnOther\)/);
  });
});

describe("the People list", () => {
  it("says how much of a total is extra, in both layouts, and not inside the phone's points column", () => {
    const card = table.slice(table.indexOf('md:hidden">'), table.indexOf("hidden overflow-x-auto"));
    const pointsColumn = card.slice(card.indexOf("shrink-0 text-2xl"), card.indexOf("</p>", card.indexOf("shrink-0 text-2xl")));
    expect(pointsColumn).not.toContain("ExtraNote");
    expect((table.match(/<ExtraNote awards=\{row\.awards\} \/>/g) ?? []).length).toBe(2);
  });

  it("can show just the people who were given extra points", () => {
    expect(table).toContain('value: "extra"');
    expect(table).toMatch(/filter === "extra" && row\.awards\.length === 0/);
  });
});
