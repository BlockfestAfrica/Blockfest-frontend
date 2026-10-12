import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * The team's alerts (lib/notify/admin-activity.ts) against the real
 * throttle (take_token, 0026): one per kind per window, a daily ceiling on
 * alerts actually sent, Rovv's own ceiling so a busy or hostile Rovv day
 * never silences Monica's, tests paced apart from real entries, and the
 * "N more" line reporting what the pace held back.
 *
 * PGlite reads JavaScript's clock, so the windows move with the faked date.
 */

const state = vi.hoisted(() => ({ db: null as unknown, sent: [] as { subject: string; text: string }[] }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/admin/recipients", () => ({
  activeAdminEmails: async () => [{ email: "team@example.test" }],
}));
vi.mock("@/lib/email/client", () => ({
  sendEmail: async (mail: { subject: string; text: string }) => {
    state.sent.push({ subject: mail.subject, text: mail.text });
    return { sent: true };
  },
}));

let db: PGlite;
let notify: typeof import("@/lib/notify/admin-activity").notifyAdminsOfActivity;

/** A minute window and a ceiling of two a day, set before the module reads them. */
beforeAll(async () => {
  vi.stubEnv("ADMIN_ACTIVITY_WINDOW_SECONDS", "60");
  vi.stubEnv("ADMIN_ACTIVITY_MAX_PER_DAY", "2");
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  notify = (await import("@/lib/notify/admin-activity")).notifyAdminsOfActivity;
}, 60_000);
afterAll(() => db?.close());

let clock = new Date("2026-10-14T09:00:05+01:00").getTime();
const later = (seconds: number) => {
  clock += seconds * 1000;
  vi.setSystemTime(new Date(clock));
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  later(3600);
  vi.stubEnv("ADMIN_ACTIVITY_ALERTS", "on");
  state.sent = [];
  await db.exec(`DELETE FROM request_throttle`);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the team's alerts", () => {
  it("send one per window, and the next one says how many were held back", async () => {
    await notify({ kind: "rovv_entry", who: "@a" });
    await notify({ kind: "rovv_entry", who: "@b" });
    await notify({ kind: "rovv_entry", who: "@c" });
    expect(state.sent).toHaveLength(1);
    later(61);
    await notify({ kind: "rovv_entry", who: "@d" });
    expect(state.sent).toHaveLength(2);
    expect(state.sent[1].text).toContain("2 more came in");
  });

  it("count the daily ceiling in alerts sent, not in events paced away", async () => {
    for (let i = 0; i < 5; i++) await notify({ kind: "submission", who: `Creator ${i}`, platformLabel: "TikTok" });
    expect(state.sent).toHaveLength(1);
    later(61);
    await notify({ kind: "submission", who: "Next", platformLabel: "TikTok" });
    expect(state.sent, "five events in one window spent one alert, not five").toHaveLength(2);
  });

  it("never let Rovv use up Monica's daily ceiling", async () => {
    for (let i = 0; i < 4; i++) {
      await notify({ kind: "rovv_entry", who: `@r${i}` });
      later(61);
    }
    expect(state.sent.filter((m) => m.subject.startsWith("New ROVV entry"))).toHaveLength(2);
    await notify({ kind: "submission", who: "Monica creator", platformLabel: "X" });
    expect(state.sent.at(-1)?.subject).toBe("New entry: Monica creator on X");
  });

  it("pace a test entry apart, so a real entry right after still alerts", async () => {
    await notify({ kind: "rovv_entry", who: "@owner (test)", test: true });
    await notify({ kind: "rovv_entry", who: "@real" });
    expect(state.sent.map((m) => m.subject)).toEqual(["New ROVV entry: @owner (test)", "New ROVV entry: @real"]);
  });

  it("send nothing while switched off", async () => {
    vi.stubEnv("ADMIN_ACTIVITY_ALERTS", "");
    await notify({ kind: "rovv_entry", who: "@a" });
    expect(state.sent).toEqual([]);
  });
});
