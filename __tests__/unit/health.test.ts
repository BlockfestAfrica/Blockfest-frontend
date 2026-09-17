/**
 * The health endpoint, and the one thing it must never leak.
 *
 * It reports which database a deploy is on, because Netlify DB's per-preview
 * branching is platform behaviour rather than anything this repository
 * arranges, and the only honest way to know it still holds is to compare a
 * preview against production.
 *
 * A hash, never the host and never the credential: the question is "same
 * database or not", and answering it must not publish an address for somebody
 * to point a client at.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { databaseFingerprint } from "@/lib/db/client";

const ROOT = process.cwd();
describe("the database fingerprint", () => {
  /*
   * Every case passes its own input.
   *
   * The first version of these asserted through process.env and the resolver,
   * which made them a statement about the machine rather than about the
   * function. They passed locally, where no database is attached, and failed
   * the Netlify build, where one is, twice.
   */
  it("is a short hash, not the host", () => {
    const print = databaseFingerprint(
      "postgres://user:secret@ep-cool-name-123456.eu-central-1.aws.neon.tech/db",
    );

    expect(print).toMatch(/^[0-9a-f]{12}$/);
    expect(print).not.toContain("neon");
    expect(print).not.toContain("secret");
    expect(print).not.toContain("user");
  });

  it("distinguishes two different databases", () => {
    expect(
      databaseFingerprint("postgres://u:p@production.example/db"),
    ).not.toBe(databaseFingerprint("postgres://u:p@preview-branch.example/db"));
  });

  it("ignores the credential, so a rotated password still matches", () => {
    // Otherwise it would report a different database every time somebody
    // rotated a secret, and stop being believed.
    expect(databaseFingerprint("postgres://u:one@same.example/db")).toBe(
      databaseFingerprint("postgres://u:two@same.example/db"),
    );
  });

  it("answers null when there is nothing to describe", () => {
    expect(databaseFingerprint(null)).toBeNull();
    expect(databaseFingerprint("")).toBeNull();
  });

  it("answers null rather than throwing on something that is not a URL", () => {
    // A malformed connection is a configuration problem, and a health endpoint
    // whose job is to keep answering must not be the thing that reports it by
    // falling over.
    expect(databaseFingerprint("not-a-connection-string")).toBeNull();
    expect(databaseFingerprint("postgres://")).toBeNull();
  });
});

describe("what the health route publishes", () => {
  it("reports the context and the fingerprint, and no connection string", () => {
    const src = readFileSync(join(ROOT, "app/api/health/route.ts"), "utf8");
    expect(src).toContain("databaseFingerprint()");
    expect(src).toContain("process.env.CONTEXT");
    expect(
      src.includes("getConnectionString") || src.includes("DATABASE_URL"),
      "the route must never read the connection itself",
    ).toBe(false);
  });

  it("is written down where the next person will look", () => {
    const doc = readFileSync(join(ROOT, "docs/DATABASE.md"), "utf8");
    expect(doc).toContain("deploy preview");
    expect(doc, "and says which way the real risk runs").toMatch(
      /seeded \*\*from production\*\*|seeded from production/,
    );
  });
});
