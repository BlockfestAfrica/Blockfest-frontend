import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { DP_ROLES } from "@/app/getdp/lib/dp";
import { DP_CHANNELS } from "@/app/getdp/lib/count";
import type { AdminIdentity } from "@/lib/admin/session";
import { applyMigrations } from "../helpers/migrations";

/*
 * The DPs made on /getdp: the public count route (app/api/getdp/generated),
 * the table it writes (0072_dp_generations.sql), and the overview's totals
 * (dpGenerations in lib/admin/metrics.ts), against the real schema.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { POST } = await import("@/app/api/getdp/generated/route");
const { dpGenerations, lagosMidnight } = await import("@/lib/admin/metrics");

const ADDRESS = "198.51.100.9";
const admin = { id: "a", email: "owner@example.test", role: "owner" } as unknown as AdminIdentity;

let db: PGlite;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("https://blockfestafrica.com/api/getdp/generated", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
        "x-nf-client-connection-ip": ADDRESS,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const rows = async () =>
  (await db.query<{ role: string; channel: string }>("SELECT role, channel FROM dp_generations ORDER BY created_at")).rows;

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec("DELETE FROM dp_generations; DELETE FROM request_throttle;");
});

describe("the table", () => {
  it("allows exactly the roles and channels the page sends", () => {
    const migration = readFileSync(
      join(process.cwd(), "netlify/database/migrations/0072_dp_generations.sql"),
      "utf8",
    );
    const listIn = (constraint: string) =>
      [...new RegExp(`${constraint}\\s+CHECK \\(\\w+ IN \\(([^)]*)\\)`).exec(migration)![1].matchAll(/'([a-z]+)'/g)].map(
        (m) => m[1],
      );
    expect(listIn("dp_generations_role").sort()).toEqual([...DP_ROLES].sort());
    expect(listIn("dp_generations_channel").sort()).toEqual([...DP_CHANNELS].sort());
  });

  it("refuses a role or channel it does not know, even past the route", async () => {
    await expect(db.query("INSERT INTO dp_generations (role, channel) VALUES ('ceo', 'x')")).rejects.toThrow(
      /dp_generations_role/,
    );
    await expect(db.query("INSERT INTO dp_generations (role, channel) VALUES ('speaker', 'fax')")).rejects.toThrow(
      /dp_generations_channel/,
    );
  });
});

describe("the count route", () => {
  it("records one row with the role and the channel, and nothing else", async () => {
    const res = await post({ role: "speaker", channel: "whatsapp" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await rows()).toEqual([{ role: "speaker", channel: "whatsapp" }]);
    const columns = (
      await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'dp_generations' ORDER BY ordinal_position",
      )
    ).rows.map((r) => r.column_name);
    expect(columns).toEqual(["id", "created_at", "role", "channel"]);
  });

  it("refuses another site, a form post, an unknown role or channel, and a body that is too big", async () => {
    expect((await post({ role: "speaker", channel: "x" }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ role: "speaker", channel: "x" }, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post({ role: "ceo", channel: "x" })).status).toBe(400);
    expect((await post({ role: "speaker", channel: "fax" })).status).toBe(400);
    expect((await post({ role: "speaker", channel: "x", name: "Ada" })).status).toBe(200);
    expect((await post({ role: "speaker", channel: "x", pad: "a".repeat(600) })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    // Only the one the schema accepted, and never the name sent beside it.
    expect(await rows()).toEqual([{ role: "speaker", channel: "x" }]);
  });

  it("stops one connection past 240 an hour, after the checks, so a refused request costs nothing", async () => {
    await post({ role: "speaker", channel: "x" }, { origin: "https://evil.example" });
    const spent = async () =>
      Number(
        (await db.query<{ n: number }>("SELECT coalesce(sum(hits), 0)::int AS n FROM request_throttle WHERE bucket = $1", [
          `getdp-generated:${ADDRESS}`,
        ])).rows[0].n,
      );
    expect(await spent()).toBe(0);
    await db.query("SELECT take_token($1, 240, 3600) FROM generate_series(1, 239)", [`getdp-generated:${ADDRESS}`]);
    expect((await post({ role: "attendee", channel: "download" })).status).toBe(200);
    const res = await post({ role: "attendee", channel: "download" });
    expect(res.status).toBe(429);
    expect((await res.json()).message).toMatch(/a lot of DPs from one place/);
    expect(await rows()).toHaveLength(1);
  });
});

describe("the overview's totals", () => {
  // 11:00 in Lagos on 10 October 2026; the day began at 23:00 UTC on the 9th.
  const NOW = new Date("2026-10-10T10:00:00Z");

  it("finds Lagos midnight, not UTC's", () => {
    expect(lagosMidnight(NOW).toISOString()).toBe("2026-10-09T23:00:00.000Z");
    expect(lagosMidnight(new Date("2026-10-09T23:30:00Z")).toISOString()).toBe("2026-10-09T23:00:00.000Z");
    expect(lagosMidnight(new Date("2026-10-09T22:59:00Z")).toISOString()).toBe("2026-10-08T23:00:00.000Z");
  });

  it("counts all time, today in Lagos, by role and by channel, most first", async () => {
    const seed = [
      ["2026-10-09T22:59:59Z", "attendee", "download"], // yesterday in Lagos
      ["2026-10-09T23:00:00Z", "attendee", "whatsapp"],
      ["2026-10-10T08:00:00Z", "speaker", "whatsapp"],
      ["2026-10-10T09:00:00Z", "attendee", "status"],
    ];
    for (const [at, role, channel] of seed) {
      await db.query("INSERT INTO dp_generations (created_at, role, channel) VALUES ($1, $2, $3)", [at, role, channel]);
    }
    expect(await dpGenerations(admin, NOW)).toEqual({
      total: 4,
      today: 3,
      byRole: [
        { name: "attendee", count: 3 },
        { name: "speaker", count: 1 },
      ],
      byChannel: [
        { name: "whatsapp", count: 2 },
        { name: "download", count: 1 },
        { name: "status", count: 1 },
      ],
    });
  });

  it("says nothing yet as zeros, not as an error", async () => {
    expect(await dpGenerations(admin, NOW)).toEqual({ total: 0, today: 0, byRole: [], byChannel: [] });
  });
});
