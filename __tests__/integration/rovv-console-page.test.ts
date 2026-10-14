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
const { RovvQueue, RovvRuleOut } = await import("@/components/admin/rovv-queue");

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

/** Every element in the tree as the server built it, client components unopened. */
function elements(node: unknown, out: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) {
    for (const n of node) elements(n, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Record<string, unknown>>;
  out.push(el);
  elements(el.props?.children, out);
  return out;
}

/** The words the page itself writes, for what it offers. */
const words = (node: unknown) =>
  elements(node)
    .flatMap((el) => [el.props.children].flat())
    .filter((c): c is string => typeof c === "string")
    .join(" ");

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

describe("the console page's tools for ROVV's answer", () => {
  const page = async (role: "owner" | "reviewer", status?: string) => {
    state.role = role;
    return Page({ searchParams: Promise.resolve(status ? { status } : {}) });
  };

  it("gives the rule-out box and ROVV's picked winners file to an owner, and neither to a reviewer", async () => {
    const owner = await page("owner");
    expect(propsOf(owner, RovvRuleOut)).not.toBeNull();
    const picked = elements(owner).find((el) => el.props.href === "/api/admin/rovv/export?of=rovv&picked=1");
    expect(picked).toBeTruthy();
    expect(words(picked)).toContain("Picked winners, for ROVV's final check (CSV)");

    const reviewer = await page("reviewer");
    expect(propsOf(reviewer, RovvRuleOut)).toBeNull();
    expect(elements(reviewer).some((el) => String(el.props.href ?? "").includes("/export"))).toBe(false);
  });

  it("tells reviewers what to do about an entrant who looks under 18", async () => {
    const tree = await page("reviewer");
    const hints = elements(tree)
      .map((el) => el.props.hint)
      .filter((h): h is string => typeof h === "string");
    expect(hints.join(" ")).toContain("If an entrant looks under 18, rule it out with that reason and tell the owner.");
  });

  it("offers 'Eligible with a note' to an owner only, and reads it only for one", async () => {
    const id = (
      await db.query<{ id: string }>(
        `INSERT INTO rovv_entries (campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url, post_key,
           referral_code, rules_version, privacy_version, status, review_note, reviewed_at, reviewed_by_admin_id)
         SELECT id, 'Bola Ade', 'bola@example.test', 'bola@example.test', 'bolaade', 'https://tiktok.com/@bolaade/video/7300000000000000002',
           'tiktok:7300000000000000002', 'BOLA123', '1.1', '1.1', 'eligible', 'Shortlist: great hook', now(), $1
           FROM campaigns WHERE slug = 'rovv' RETURNING id`,
        [state.adminId],
      )
    ).rows[0].id;
    try {
      const owner = await page("owner", "noted");
      expect(words(owner)).toContain("Eligible with a note");
      expect((propsOf(owner, RovvQueue)?.items as { id: string }[]).map((i) => i.id)).toEqual([id]);

      // A reviewer asking for it gets the default list, not the filter.
      const reviewer = await page("reviewer", "noted");
      expect(words(reviewer)).not.toContain("Eligible with a note");
      expect((propsOf(reviewer, RovvQueue)?.items as unknown[]).length).toBe(2);
    } finally {
      await db.query(`DELETE FROM rovv_entries WHERE id = $1`, [id]);
    }
  });

  it("hands the list each entry's emailed ruling, and whether the winners are out", async () => {
    const owner = await page("owner", "winners");
    const queue = propsOf(owner, RovvQueue)!;
    expect((queue.items as { rulingEmailed: unknown }[]).map((i) => i.rulingEmailed)).toEqual([null]);
    expect(queue.announced).toBe(false);

    await db.query(`UPDATE rovv_entries SET notified_at = now()`);
    try {
      expect(propsOf(await page("owner", "winners"), RovvQueue)!.announced).toBe(true);
    } finally {
      await db.query(`UPDATE rovv_entries SET notified_at = NULL`);
    }
  });
});
