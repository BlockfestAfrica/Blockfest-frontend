/**
 * Structured data cannot close its own script element.
 *
 * JSON-LD goes into the page through dangerouslySetInnerHTML, which React
 * writes out verbatim. JSON.stringify leaves "<" alone, so any value
 * containing "</script" ended the element and the rest was parsed as HTML.
 * The newsletter page fills its JSON-LD from the Substack feed, so one
 * closing tag in a post title was all that stood between that feed and
 * script running on the console's origin.
 *
 * lib/json-ld.ts escapes the payload. The page-level proof, a hostile feed
 * title rendered through the real page, is in newsletter.test.ts. This file
 * holds the helper to its contract and holds every JSON-LD script to the
 * helper, because the next one to carry fetched data will look exactly like
 * the ones that only carry constants.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jsonLd } from "@/lib/json-ld";

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

/* Comments stripped: this codebase explains itself in prose, and an
   assertion that reads prose reports the thing it checks for as present. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("jsonLd", () => {
  const SEPARATORS = String.fromCharCode(0x2028, 0x2029);
  const hostile = {
    headline: `a </script><b>x</b> & </SCRIPT > <!-- ${SEPARATORS}`,
    nested: [{ name: "<img src=x onerror=alert(1)>" }],
  };

  it("leaves nothing an HTML parser would act on", () => {
    const out = jsonLd(hostile);
    for (const char of ["<", ">", "&", ...SEPARATORS]) {
      expect(out.includes(char), JSON.stringify(char)).toBe(false);
    }
  });

  it("reads back as exactly the same data", () => {
    // Escaped, not stripped: a crawler must see the title as it was published.
    expect(JSON.parse(jsonLd(hostile))).toEqual(hostile);
  });

  it("matches JSON.stringify when there is nothing to escape", () => {
    const plain = { "@context": "https://schema.org", name: "Blockf3st" };
    expect(jsonLd(plain)).toBe(JSON.stringify(plain));
  });
});

describe("every JSON-LD script on the site", () => {
  const source = (file: string) =>
    codeOnly(readFileSync(join(ROOT, file), "utf8"));
  const sites = filesUnder(["app", "components", "lib"]).filter((file) =>
    source(file).includes("application/ld+json")
  );

  it("is found, so the check below is not passing over nothing", () => {
    expect(sites).toContain(join("app", "newsletter", "page.tsx"));
    expect(sites).toContain(join("app", "layout.tsx"));
  });

  it("serialises through jsonLd", () => {
    for (const file of sites) {
      const src = source(file);
      const declared = src.split("application/ld+json").length - 1;
      // The body of each JSON-LD element, whatever feeds it: a value built
      // with JSON.stringify on an earlier line and passed in by name fails
      // the same as one stringified inline. [^<>] keeps a match inside its
      // own element, so the layout's service worker script is not swept up.
      const bodies = [
        ...src.matchAll(/application\/ld\+json"[^<>]*?__html\s*:\s*([^\s,}]+)/g),
      ].map((m) => m[1]);
      expect(bodies.length, `${file}: a JSON-LD body not found`).toBe(declared);
      for (const body of bodies) {
        expect(body.startsWith("jsonLd("), `${file}: ${body}`).toBe(true);
      }
    }
  });
});
