/**
 * The site has one focus ring and nothing may delete it.
 *
 * globals.css declares a single :focus-visible outline in @layer base, and its
 * own comment says "none may use outline-none without a replacement". Nineteen
 * controls used it anyway. Tailwind v4 puts utilities in a later cascade layer
 * than base, so `focus:outline-none` wins and silently removes the only focus
 * indicator the product has.
 *
 * It shipped because it looks like tidiness. Nothing breaks, nothing warns, and
 * the loss is invisible to anybody using a mouse. With the admin screens now
 * built without fills, that ring is the only thing telling a keyboard user
 * which of three money fields they are typing into.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function filesUnder(dirs: string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) found.push(next);
    }
  };
  dirs.forEach(walk);
  return found;
}

/** Comments explaining the rule are not breaches of it. */
const code = (file: string) =>
  readFileSync(join(ROOT, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Every className on an element, so a replacement can be looked for beside the
 * removal rather than anywhere in the file.
 */
function classAttributes(file: string): string[] {
  const src = code(file);
  return [
    ...[...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/className=\{`([^`]*)`\}/g)].map((m) => m[1]),
    ...[...src.matchAll(/^\s*"([^"]*outline-none[^"]*)",?$/gm)].map((m) => m[1]),
  ];
}

/** Removal is fine when the same element declares a ring in its place. */
const replaced = (cls: string) => /focus-visible:ring-|focus:ring-/.test(cls);

describe("the focus ring", () => {
  it("is declared once, site-wide", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:/);
  });

  /**
   * The narrow rule, and the only one that matters.
   *
   * globals.css permits removing the outline when something replaces it, and
   * the marketing pages do exactly that: outline-none followed by ring-2 on the
   * same element. What shipped on the campaign screens was removal with nothing
   * in its place, nineteen times, leaving those controls with no focus
   * indicator at all.
   *
   * An earlier version of this test forbade the removal outright and flagged
   * six correct call sites. A guard that cannot tell a replacement from a
   * deletion makes work rather than preventing it.
   */
  it("is never removed without something put in its place", () => {
    const offenders: string[] = [];

    for (const file of filesUnder(["app", "components"])) {
      for (const cls of classAttributes(file)) {
        if (!/\boutline-none\b/.test(cls)) continue;
        if (replaced(cls)) continue;
        offenders.push(`${file}: ${cls.slice(0, 90)}`);
      }
    }

    expect(
      offenders,
      `these leave an element with no focus indicator at all, because Tailwind's utilities layer beats the base rule in globals.css:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("knows the difference, so it cannot pass by seeing nothing", () => {
    expect(replaced("focus-visible:outline-none focus-visible:ring-2")).toBe(true);
    expect(replaced("focus:outline-none focus:border-brand-gold")).toBe(false);
  });
});
