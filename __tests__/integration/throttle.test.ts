/**
 * A rate limit that exists.
 *
 * throttleKey was written with a careful comment about why x-forwarded-for is
 * not safe to key on, and then nothing ever called it, so registration and the
 * entry link ran unthrottled. The registration oracle finding is what made that
 * matter: "that email is taken" and "that phone is taken" are distinct answers,
 * Nigerian mobile numbers are a walkable space, and nothing slowed the walking.
 *
 * The counter lives in Postgres because the functions are serverless and a
 * module variable resets on every cold start, which would hand an attacker a
 * fresh budget for waiting.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;

const take = async (bucket: string, limit = 3, seconds = 3600) =>
  (
    await db.query<{ ok: boolean }>(
      `SELECT take_token($1, $2, $3) AS ok`,
      [bucket, limit, seconds],
    )
  ).rows[0].ok;

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM request_throttle`);
});

describe("taking tokens", () => {
  it("allows up to the limit and refuses the next", async () => {
    expect(await take("register:1.2.3.4")).toBe(true);
    expect(await take("register:1.2.3.4")).toBe(true);
    expect(await take("register:1.2.3.4")).toBe(true);
    expect(await take("register:1.2.3.4"), "the fourth of three").toBe(false);
  });

  it("counts each address separately", async () => {
    // The point of keying on the address: one attacker spending their budget
    // must not spend anybody else's.
    for (let i = 0; i < 3; i += 1) await take("register:1.2.3.4");
    expect(await take("register:1.2.3.4")).toBe(false);
    expect(await take("register:5.6.7.8"), "a different visitor").toBe(true);
  });

  it("counts each limit separately", async () => {
    for (let i = 0; i < 3; i += 1) await take("register:1.2.3.4");
    expect(await take("register:1.2.3.4")).toBe(false);
    expect(await take("enter:1.2.3.4"), "a different surface").toBe(true);
  });

  it("resets when the window turns over", async () => {
    // A one second window, then wait for it to pass.
    for (let i = 0; i < 3; i += 1) await take("w:1.2.3.4", 3, 1);
    expect(await take("w:1.2.3.4", 3, 1)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await take("w:1.2.3.4", 3, 1), "a new window, a new budget").toBe(true);
  });

  it("does not throttle an empty bucket", async () => {
    // No key means the platform header was absent. One shared bucket would
    // have the campaign rate limiting itself on launch morning, so absent
    // means unthrottled, which throttleKey's SHARED_BUCKET caller also
    // enforces a layer up.
    for (let i = 0; i < 10; i += 1) {
      expect(await take("", 3)).toBe(true);
    }
    expect(await take(null as unknown as string, 3)).toBe(true);
  });

  /**
   * The concurrency property the single statement exists for: n parallel
   * requests against a limit of three let exactly three through, never four,
   * because the upsert's row lock serialises the increment with the read.
   */
  it("never lets two racing requests both take the last token", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => take("race:1.2.3.4", 3)),
    );
    expect(results.filter(Boolean).length).toBe(3);
  });
});

describe("the wiring", () => {
  it("registration and the entry link both actually call it", async () => {
    // The finding was not a missing limiter, it was a limiter nothing called.
    // This stops that recurring.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const file of [
      "app/api/campaigns/monica/register/route.ts",
      "app/campaigns/monica-money-story/enter/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src, `${file} must consult the throttle`).toContain("await allow(");
    }
  });
});
