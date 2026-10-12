import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { isValidElement, type ReactElement } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * What the ROVV console page hands its client components, by role.
 *
 * A winner's ticket code is a free pass and owner business: the code box
 * is owner-only, but anything passed to a client component is serialised
 * into the page itself, so a code in a reviewer's props is a code in a
 * reviewer's page source. Rendered here as the server renders it, and the
 * props inspected.
 */

const state = vi.hoisted(() => ({ db: null as unknown, adminId: "", role: "owner" as "owner" | "reviewer" }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/admin/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/session")>();
  return {
    ...real,
    requireAdmin: async () => ({
      ok: true,
      admin: { adminId: state.adminId, role: state.role, email: `${state.role}@example.test` },
    }),
  };
});

const Page = (await import("@/app/admin/(console)/rovv/page")).default;
const { RovvQueue } = await import("@/components/admin/rovv-queue");

let db: PGlite;

function propsOf(node: unknown, type: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = propsOf(n, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<Record<string, unknown>>;
  if (el.type === type) return el.props;
  return propsOf(el.props?.children, type);
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  state.adminId = (
    await db.query<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role) VALUES ('o@example.test','o@example.test','x','owner') RETURNING id`,
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO rovv_entries (campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url, post_key,
       referral_code, rules_version, privacy_version, status, reviewed_at, reviewed_by_admin_id, winner_at, winner_by_admin_id, ticket_code)
     SELECT id, 'Ada Obi', 'ada@example.test', 'ada@example.test', 'adaobi', 'https://tiktok.com/@adaobi/video/7300000000000000001',
       'tiktok:7300000000000000001', 'ADA123', '1.1', '1.1', 'eligible', now(), $1, now(), $1, 'BUIDL-LIVE-1'
       FROM campaigns WHERE slug = 'rovv'`,
    [state.adminId],
  );
}, 60_000);
afterAll(() => db?.close());
beforeEach(() => {
  state.role = "owner";
});

const itemsFor = async (role: "owner" | "reviewer") => {
  state.role = role;
  const tree = await Page({ searchParams: Promise.resolve({ status: "winners" }) });
  return (propsOf(tree, RovvQueue)?.items ?? []) as { ticketCode: string | null }[];
};

describe("the ROVV console page", () => {
  it("gives an owner each winner's code", async () => {
    expect((await itemsFor("owner")).map((i) => i.ticketCode)).toEqual(["BUIDL-LIVE-1"]);
  });

  it("never puts a code in a reviewer's page, not even in the data behind it", async () => {
    const items = await itemsFor("reviewer");
    expect(items).toHaveLength(1);
    expect(items.map((i) => i.ticketCode)).toEqual([null]);
    expect(JSON.stringify(items)).not.toContain("BUIDL-LIVE-1");
  });
});
