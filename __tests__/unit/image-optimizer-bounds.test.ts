/**
 * /_next/image only makes the variants the site's own pages ask for.
 *
 * The endpoint is public and takes its url, width and quality from the query
 * string, and every combination it has not seen before is a cache miss that
 * decodes the whole source and encodes it again. With no qualities list it
 * took any q from 1 to 100, with no localPatterns it took any path on the site
 * with any query string on the end, and with AVIF listed the Accept header
 * could choose the slowest encoder there is. Speaker photos are committed at
 * up to 31 megapixels and one home page logo at 107, so an anonymous visitor
 * could ask for thousands of full transforms of one file.
 *
 * These cases go through Next's own validation, the function that answers
 * /_next/image, rather than reading the config as text, so they fail if the
 * installed Next stops enforcing the lists as well as if the lists go. The
 * second half is the other direction: every quality and every image path the
 * pages render is still accepted, so tightening the lists cannot quietly turn
 * a speaker photo or a sponsor logo into a 400.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer";
import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const ROOT = process.env.PWD ?? process.cwd();

/* Comments stripped: this codebase explains itself in prose, and an
   assertion that reads prose reports the thing it checks for as present. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const images = nextConfig.images ?? {};

type Config = Parameters<typeof ImageOptimizerCache.validateParams>[2];

/** What the optimizer says to one request, as a browser would send it. */
function ask(url: string, q: number | string, w = 3840): string {
  const req = {
    headers: { accept: "image/avif,image/webp,image/apng,*/*;q=0.8" },
  } as unknown as IncomingMessage;
  const result = ImageOptimizerCache.validateParams(
    req,
    { url, w: String(w), q: String(q) },
    { images: { ...images } } as unknown as Config,
    false,
  );
  return "errorMessage" in result ? result.errorMessage : result.mimeType;
}

const PHOTO = "/images/speakers/ola.jpg";

describe("the image optimizer", () => {
  it("refuses a quality the pages never render", () => {
    for (const q of [1, 2, 50, 74, 100]) {
      expect(ask(PHOTO, q), `q=${q}`).toMatch(/quality.*not allowed/);
    }
  });

  it("refuses a query string on a local url", () => {
    // Each suffix was a new cache key for the same file, which is what made
    // the variant count unbounded rather than merely large.
    expect(ask(`${PHOTO}?v=1`, 75)).toMatch(/not allowed/);
  });

  it("refuses paths outside the directories the pages render from", () => {
    expect(ask("/videos/venue-announcement-poster.webp", 75)).toMatch(/not allowed/);
    expect(ask("/icon-512.png", 75)).toMatch(/not allowed/);
  });

  it("never lets the Accept header choose the AVIF encoder", () => {
    expect(images.formats ?? []).not.toContain("image/avif");
    expect(ask(PHOTO, 75)).toBe("image/webp");
  });

  it("is pinned to the three qualities the site uses", () => {
    expect([...(images.qualities ?? [])].sort((a, b) => a - b)).toEqual([60, 75, 85]);
  });

  it("is pinned to the two directories the site renders from", () => {
    expect(images.localPatterns).toEqual([
      { pathname: "/images/**", search: "" },
      { pathname: "/2026/**", search: "" },
    ]);
  });
});

/** Tracked source under app, components and lib, comments stripped. */
function sources(): { file: string; code: string }[] {
  return execFileSync("git", ["ls-files", "-z", "app", "components", "lib"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => ({
      file,
      code: codeOnly(readFileSync(join(ROOT, file), "utf8")),
    }));
}

describe("what the pages render", () => {
  const all = sources();
  const rendering = all.filter(({ code }) => /from\s+["']next\/image["']/.test(code));

  it("asks only for qualities the optimizer accepts", () => {
    // 75 is what next/image sends when a component sets no quality.
    const used = new Set([75]);
    for (const { code } of rendering) {
      for (const m of code.matchAll(/quality=\{\s*(\d+)\s*\}/g)) used.add(Number(m[1]));
    }

    for (const q of used) {
      expect(ask(PHOTO, q, 640), `quality ${q} is rendered but refused`).toMatch(/^image\//);
    }
  });

  it("asks only for paths the optimizer accepts", () => {
    // Components that render next/image, and lib/, where the speaker, partner,
    // campaign and gallery lists they render from are kept.
    const paths = new Set<string>();
    for (const { code } of [...rendering, ...all.filter(({ file }) => file.startsWith("lib/"))]) {
      for (const m of code.matchAll(/["'`](\/[^"'`\s]*\.(?:png|jpe?g|webp|avif|gif|svg))["'`]/gi)) {
        paths.add(m[1]);
      }
    }

    // A regex that stops matching would otherwise pass on an empty list.
    expect(paths.size).toBeGreaterThan(50);
    const refused = [...paths].filter((path) => !hasLocalMatch(images.localPatterns, path));
    expect(refused, "rendered through next/image but outside images.localPatterns").toEqual([]);
  });
});
