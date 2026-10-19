/**
 * Gotham's no-break space.
 *
 * This build of Gotham draws U+00A0 400px wide at 16px, so lib/fonts.ts
 * leaves that one character out of the face's unicode-range and the browser
 * draws it from the fallback font. next/font is a compile-time transform and
 * cannot run here, so this holds the declaration itself: the gap stays, and
 * nothing a page actually writes falls out of Gotham with it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/fonts.ts"), "utf8");
const declared = /prop:\s*"unicode-range",\s*value:\s*"([^"]+)"/.exec(source)?.[1];

/** "U+0000-009F, U+00A1-10FFFF" as [start, end] pairs. */
function ranges(value: string): [number, number][] {
  return value.split(",").map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    const start = parseInt(a, 16);
    return [start, b === undefined ? start : parseInt(b, 16)];
  });
}
const covers = (cp: number) => ranges(declared ?? "").some(([a, b]) => cp >= a && cp <= b);

describe("Gotham's unicode-range", () => {
  it("is declared", () => {
    expect(declared).toBeTruthy();
  });

  it("leaves out the no-break space, so the fallback draws it as an ordinary space", () => {
    expect(covers(0x00a0)).toBe(false);
  });

  it("keeps everything else a page writes in Gotham", () => {
    const written = [
      0x20, // space
      0x41, // A
      0x7a, // z
      0x9f, // the last code point before the gap
      0xa1, // the first after it
      0xe9, // é
      0x2019, // ’
      0x2014, // —
      0x20a6, // ₦
      0x2192, // →
      0x10ffff, // the last code point
    ];
    for (const cp of written) expect(covers(cp), `U+${cp.toString(16).toUpperCase()}`).toBe(true);
  });
});
