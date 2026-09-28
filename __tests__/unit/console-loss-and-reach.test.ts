import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Comments stripped: this codebase explains itself in prose, and an
   assertion that reads prose reports the thing it checks for as present. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const read = (p: string) => codeOnly(readFileSync(join(process.cwd(), p), "utf8"));

const EDITOR = "components/admin/challenge-editor.tsx";
const RESOURCES = "components/admin/resources-editor.tsx";
const PEOPLE = "components/admin/participants-table.tsx";

describe("the stage brief", () => {
  const src = read(EDITOR);

  it("is not thrown away silently", () => {
    // Up to 2,000 characters lived only in React state, and Cancel called
    // setOpen(null) directly. This is the text emailed to every creator.
    expect(src).not.toMatch(/open === challenge\.id \? setOpen\(null\)/);
    expect(src).toContain("askToLeave");
    expect(src).toContain("Discard what you have written?");
  });

  it("guards the week switch too, not just Cancel", () => {
    // One `form` object is shared by every week, so opening a second week
    // overwrote the first in place. Both exits go through one function.
    expect(src).toMatch(/askToLeave\(challenge\)/);
    expect(src).toMatch(/askToLeave\(null\)/);
  });

  it("knows whether anything was actually typed", () => {
    expect(src).toContain("const dirty =");
    expect(src).toContain("setBaseline");
  });

  it("does not warn after a successful save", () => {
    const save = src.slice(src.indexOf("async function save"), src.indexOf("return ("));
    expect(save).toContain("setBaseline(null)");
  });
});

describe("deleting a pack resource", () => {
  it("asks first, like every other destructive action", () => {
    const src = read(RESOURCES);
    expect(src).toContain("<Confirm");
    expect(src).toContain("Yes, delete it");
    expect(src).not.toMatch(/onClick=\{\(\) => remove\(row\.id\)\}/);
  });
});

describe("disqualify and handle-fix", () => {
  const src = read(PEOPLE);

  it("exist above 768px, where the owner actually works", () => {
    // Both lived only inside the md:hidden card list, so on a laptop
    // /api/admin/void had no caller anywhere in the app.
    const table = src.slice(src.indexOf("<table"));
    expect(table).toContain("Disqualify");
    expect(table).toContain("fix");
  });

  it("render their panel once, outside the responsive split", () => {
    // Adding the buttons alone would have set state and shown nothing,
    // because the panels were in the per-row card markup.
    expect(src).toContain("voidingRow");
    expect(src).toMatch(/\{voidingRow && \(/);
    expect(src).toMatch(/\{fixing && \(/);
    expect(src).not.toMatch(/\{voiding === row\.enrolmentId && \(/);
  });

  it("keeps the owner-only gate the card list used", () => {
    expect(src).toMatch(/canCorrectHandles && row\.active/);
  });
});
