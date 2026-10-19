/**
 * announcedWinners, against a real Postgres: the list the owner pays the
 * weekly prizes from, so it must hold every announced win of both awards,
 * nothing that was only drafted, and the tag exactly as registered.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { announcedWinners } = await import("@/lib/admin/winners");

const SLUG = "monica-money-story";
const OWNER = { adminId: "", role: "owner", email: "owner@example.test" } as never;

let db: PGlite;
let seq = 0;
let campaignId: string;

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, params)).rows[0];

/** A registered creator, with a Monica tag or, like the earliest registrants, none. */
async function creator(name: string, monicaTag: string | null) {
  const n = ++seq;
  const row = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche, monica_tag)
     VALUES ($1, $2, $2, $3, $4, 'finance', $5) RETURNING id`,
    [name, `c${n}@example.test`, `0${n}`, `+234${String(n).padStart(10, "0")}`, monicaTag],
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
     VALUES ($1, $2, $3, 100, 1) RETURNING id`,
    [campaignId, row.id, `CODE${n}`],
  );
  return enrolment.id;
}

/** A win, announced unless it is a draft. Distinct times, so order never rests on a tie. */
async function win(
  week: number,
  category: "creator_of_week" | "community_favourite",
  enrolment: string,
  opts: { prize?: number; draft?: boolean } = {},
) {
  await db.query(
    `INSERT INTO weekly_winners (campaign_id, week_no, category, campaign_creator_id, prize_amount_naira, published_at)
     VALUES ($1, $2, $3::winner_category, $4, $5, $6)`,
    [
      campaignId,
      week,
      category,
      enrolment,
      opts.prize ?? 100000,
      opts.draft ? null : new Date(Date.UTC(2026, 8, week * 7, category === "creator_of_week" ? 18 : 20)),
    ],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = $1`, [SLUG])).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, [SLUG]);
});

describe("every winner so far", () => {
  it("lists each announced win of both awards, week by week, Creator of the Week first, with the tag and prize", async () => {
    const ada = await creator("Ada Obi", "ada.obi");
    const bola = await creator("Bola Ade", "bola_ade");
    const chi = await creator("Chi Eze", "chi-eze");
    // Inserted out of order on purpose.
    await win(2, "community_favourite", chi, { prize: 50000 });
    await win(1, "community_favourite", bola, { prize: 50000 });
    await win(2, "creator_of_week", bola);
    await win(1, "creator_of_week", ada);

    const rows = await announcedWinners(OWNER);
    expect(rows.map((r) => [r.weekNo, r.category, r.name, r.monicaTag, r.prizeNaira])).toEqual([
      [1, "creator_of_week", "Ada Obi", "ada.obi", 100000],
      [1, "community_favourite", "Bola Ade", "bola_ade", 50000],
      [2, "creator_of_week", "Bola Ade", "bola_ade", 100000],
      [2, "community_favourite", "Chi Eze", "chi-eze", 50000],
    ]);
    expect(rows.every((r) => r.publishedAt instanceof Date && !Number.isNaN(r.publishedAt.getTime()))).toBe(true);
  });

  it("leaves out a pick that was only saved as a draft: nothing is owed on it", async () => {
    const ada = await creator("Ada Obi", "ada.obi");
    const bola = await creator("Bola Ade", "bola_ade");
    await win(1, "creator_of_week", ada);
    await win(2, "creator_of_week", bola, { draft: true });

    expect((await announcedWinners(OWNER)).map((r) => r.name)).toEqual(["Ada Obi"]);
  });

  it("gives no tag, and the address to ask, for a winner who registered before the form asked for one", async () => {
    const early = await creator("Dayo Early", null);
    await win(1, "creator_of_week", early);

    const [row] = await announcedWinners(OWNER);
    expect(row.monicaTag).toBeNull();
    expect(row.email).toMatch(/^c\d+@example\.test$/);
  });

  it("is empty before the first announcement", async () => {
    expect(await announcedWinners(OWNER)).toEqual([]);
  });
});
