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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();
const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("the database fingerprint", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is a short hash, not the host", async () => {
    process.env.DATABASE_URL =
      "postgres://user:secret@ep-cool-name-123456.eu-central-1.aws.neon.tech/db";
    const { databaseFingerprint } = await import("@/lib/db/client");
    const print = databaseFingerprint();

    expect(print).toMatch(/^[0-9a-f]{12}$/);
    expect(print).not.toContain("neon");
    expect(print).not.toContain("secret");
    expect(print).not.toContain("user");
  });

  it("distinguishes two different databases", async () => {
    process.env.DATABASE_URL = "postgres://u:p@production.example/db";
    const a = (await import("@/lib/db/client")).databaseFingerprint();
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://u:p@preview-branch.example/db";
    const b = (await import("@/lib/db/client")).databaseFingerprint();

    expect(a).not.toBe(b);
  });

  it("ignores the credential, so a rotated password still matches", async () => {
    // Otherwise the comparison would report a different database every time
    // somebody rotated a secret, and stop being believed.
    process.env.DATABASE_URL = "postgres://u:one@same.example/db";
    const a = (await import("@/lib/db/client")).databaseFingerprint();
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://u:two@same.example/db";
    const b = (await import("@/lib/db/client")).databaseFingerprint();

    expect(a).toBe(b);
  });

  it("answers null rather than throwing when there is nothing to describe", async () => {
    /*
     * The resolver is mocked, not the environment.
     *
     * The first version of this deleted DATABASE_URL and expected null, which
     * passed locally and failed the Netlify build: the fallback is
     * getConnectionString(), which resolves inside a Netlify build because the
     * database is attached there. "Nothing to describe" is not reachable by
     * unsetting a variable, so it has to be arranged.
     *
     * This is the second time a test in this repository read ambient
     * environment and was green everywhere except the one place that gates
     * deploys.
     */
    delete process.env.DATABASE_URL;
    vi.doMock("@netlify/database", () => ({
      getConnectionString: () => {
        throw new Error("no database attached");
      },
      MissingDatabaseConnectionError: class extends Error {},
    }));

    const { databaseFingerprint } = await import("@/lib/db/client");
    expect(databaseFingerprint()).toBeNull();
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
