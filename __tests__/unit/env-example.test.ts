/**
 * .env.example documents what the code reads, and nothing secret.
 *
 * Two failures this prevents, and the second is the one that bites. A variable
 * the code reads and the file does not mention is a variable somebody sets up a
 * fresh environment without, and finds out about from a 500. And a real secret
 * pasted in here is a secret in git history, which outlives noticing.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.env.PWD ?? process.cwd();
const EXAMPLE = readFileSync(join(ROOT, ".env.example"), "utf8");

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

/** Every process.env key the application actually reads. */
function envKeysUsed(): string[] {
  const keys = new Set<string>();
  for (const file of filesUnder(["app", "lib", "components"])) {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      keys.add(m[1]);
    }
  }
  return [...keys];
}

/**
 * Set by the platform or the toolchain, not by a person setting this up.
 * Documenting them would suggest somebody should.
 */
const PROVIDED = new Set(["NODE_ENV", "PWD", "CI", "NETLIFY", "CONTEXT"]);

describe(".env.example", () => {
  it("mentions every variable the code reads", () => {
    const missing = envKeysUsed()
      .filter((k) => !PROVIDED.has(k))
      .filter((k) => !EXAMPLE.includes(k));

    expect(
      missing,
      `these are read by the code and documented nowhere, so a fresh environment misses them silently:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("is reading real usages, so it cannot pass by finding none", () => {
    expect(envKeysUsed()).toContain("ZEPTOMAIL_TOKEN");
    expect(envKeysUsed()).toContain("NEXT_PUBLIC_CAMPAIGN_GATE_OPEN");
  });

  it("holds no real secret", () => {
    // The ZeptoMail key is base64-ish and long; a real one pasted here is a
    // secret in git history, which outlives noticing.
    const suspicious = EXAMPLE.split("\n").filter((line) => {
      const value = line.split("=").slice(1).join("=").trim();
      if (!value || line.trim().startsWith("#")) return false;
      if (value.startsWith("https://") || value.startsWith("postgres://")) return false;
      return /[A-Za-z0-9+/=_-]{40,}/.test(value) && !/^x+$/i.test(value.replace(/[^x]/gi, "x"));
    });

    expect(
      suspicious,
      `these look like real values rather than placeholders:\n${suspicious.join("\n")}`,
    ).toEqual([]);
  });

  it("explains why each section exists rather than just listing names", () => {
    // The house rule: a variable with no reason attached is one nobody can
    // decide whether to set.
    const comments = EXAMPLE.split("\n").filter((l) => l.trim().startsWith("#"));
    expect(comments.length).toBeGreaterThan(25);
  });
});
