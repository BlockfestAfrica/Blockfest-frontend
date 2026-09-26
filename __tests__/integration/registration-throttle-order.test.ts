import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * A registration the route refuses must not spend the address's budget.
 *
 * The register throttle is keyed on the client address alone, and on a
 * Nigerian carrier NAT one address is a crowd of real registrants. It used to
 * run first, ahead of the size, origin and content-type checks, so a page on
 * any site could have each visitor's browser fire simple cross-site posts (a
 * text/plain form or a no-cors fetch, neither preflighted), every one refused
 * as not same-origin but only after take_token had counted it. Three hundred
 * of those and everybody behind that address got "That is a lot of attempts"
 * until the hour turned.
 *
 * public-write-guards.test.ts asserts the refusals themselves but never sets
 * x-nf-client-connection-ip, so allowKey returns before touching the database
 * and the ordering is invisible there. These set it, and run the real
 * take_token against the real schema, so the bucket that fills is the one
 * production fills.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { POST } = await import("@/app/api/campaigns/monica/register/route");

/** A documentation address, standing in for one carrier egress. */
const ADDRESS = "198.51.100.7";
const BUCKET = `register:${ADDRESS}`;
/** The route's allow(request, "register", 300, 3600). */
const LIMIT = 300;

let db: PGlite;

function post(headers: Record<string, string>, body = "{}") {
  return POST(
    new NextRequest("https://blockfestafrica.com/api/campaigns/monica/register", {
      method: "POST",
      headers: {
        "x-forwarded-host": "blockfestafrica.com",
        "x-nf-client-connection-ip": ADDRESS,
        ...headers,
      },
      body,
    }),
  );
}

/** What an attacker's page can make a visitor's browser send, unpreflighted. */
const crossSite = () =>
  post({
    origin: "https://evil.example",
    "content-type": "text/plain;charset=UTF-8",
  });

/** The campaign's own form, carrying a body the schema refuses. */
const ownForm = () =>
  post({
    origin: "https://blockfestafrica.com",
    "content-type": "application/json",
  });

/** Summed over windows, so an hour turning mid-test cannot hide a spend. */
const spent = async () =>
  Number(
    (
      await db.query<{ hits: number }>(
        `SELECT coalesce(sum(hits), 0)::int AS hits FROM request_throttle WHERE bucket = $1`,
        [BUCKET],
      )
    ).rows[0].hits,
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM request_throttle`);
});

describe("the register throttle and the requests it refuses anyway", () => {
  it("spends nothing on a request refused for its shape", async () => {
    expect((await crossSite()).status, "a foreign origin").toBe(403);
    expect(
      (await post({ "content-type": "application/json" })).status,
      "no origin at all",
    ).toBe(403);
    expect(
      (
        await post({
          origin: "https://blockfestafrica.com",
          "content-type": "text/plain;charset=UTF-8",
        })
      ).status,
      "the right origin, but not JSON",
    ).toBe(415);
    expect(
      (
        await post({
          origin: "https://blockfestafrica.com",
          "content-type": "application/json",
          "content-length": String(64 * 1024),
        })
      ).status,
      "declared larger than any form",
    ).toBe(413);

    expect(await spent(), "a refused request must not take a token").toBe(0);
  });

  it("does not let a burst of cross-site posts lock out the address", async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await crossSite()).status).toBe(403);
    }

    const response = await ownForm();
    const body = (await response.json()) as { message?: string };
    expect(
      response.status,
      `the registrant behind that address was answered: ${body.message}`,
    ).toBe(400);
    // The positive half: the throttle is still consulted, on the same bucket,
    // by the one request that passed the shape checks, and by nothing else.
    expect(await spent()).toBe(1);
  });

  it("still refuses a well-formed request once the address is over the limit", async () => {
    // Both the current window and the next one are filled, the way take_token
    // computes them, so the hour turning between this and the request cannot
    // hand it a fresh budget.
    await db.query(
      `INSERT INTO request_throttle (bucket, window_start, hits)
       SELECT $1, to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600) + make_interval(hours => h), $2
         FROM generate_series(0, 1) AS h`,
      [BUCKET, LIMIT],
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await ownForm();
    expect(response.status).toBe(429);
    expect(((await response.json()) as { message: string }).message).toBe(
      "That is a lot of attempts from one place. Wait a few minutes and try again.",
    );
  });
});
