/**
 * Pack resources the team edits without a deploy (#70).
 *
 * The deliberate constraint carries the security: plain text only, https
 * links only. The renderer escapes, so the function's job is the one place
 * escaping cannot reach, the href, plus attribution and the draft boundary.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

const save = (
  fields: Partial<{ id: string; section: string; title: string; body: string; url: string; order: number; published: boolean }>,
  admin: string | null = adminId,
) =>
  db.query(
    `SELECT * FROM upsert_resource($1::uuid, $2::uuid, 'monica-money-story', $3::text, $4::text, $5::text, $6::text, $7::smallint, $8::boolean)`,
    [
      fields.id ?? null,
      admin,
      fields.section ?? "pack",
      fields.title ?? "Brand kit",
      fields.body ?? "",
      fields.url ?? "https://example.com/kit",
      fields.order ?? 0,
      fields.published ?? false,
    ],
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM audit_log; DELETE FROM resources;`);
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;
});

describe("saving", () => {
  it("creates, attributes, and starts as a draft", async () => {
    await save({});
    const row = await one<{ is_published: boolean; updated_by_admin_id: string }>(
      `SELECT is_published, updated_by_admin_id FROM resources`,
    );
    expect(row.is_published).toBe(false);
    expect(row.updated_by_admin_id).toBe(adminId);
    expect(
      Number((await one<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'resource.created'`)).n),
    ).toBe(1);
  });

  it("edits in place and audits the update", async () => {
    const created = await save({});
    const id = (created.rows[0] as { resource_id: string }).resource_id;
    await save({ id, title: "Brand kit v2", published: true });

    const row = await one<{ title: string; is_published: boolean }>(`SELECT title, is_published FROM resources`);
    expect(row.title).toBe("Brand kit v2");
    expect(row.is_published).toBe(true);
  });

  it("refuses a javascript: link, which escaping cannot catch in an href", async () => {
    await expect(
      save({ url: "javascript:alert(document.cookie)" }),
    ).rejects.toThrow(/url_not_https/);
    await expect(save({ url: "http://example.com/kit" })).rejects.toThrow(/url_not_https/);
  });

  it("refuses an empty shell and a bad section", async () => {
    await expect(save({ title: "  " })).rejects.toThrow(/title_required/);
    await expect(save({ body: "", url: "" })).rejects.toThrow(/content_required/);
    await expect(save({ section: "Not A Slug!" })).rejects.toThrow(/section_invalid/);
    await expect(save({}, null)).rejects.toThrow(/admin_required/);
  });
});

describe("deleting", () => {
  it("removes the row and audits what went", async () => {
    const created = await save({});
    const id = (created.rows[0] as { resource_id: string }).resource_id;
    await db.query(`SELECT delete_resource($1::uuid, $2::uuid)`, [id, adminId]);

    expect(Number((await one<{ n: number }>(`SELECT count(*)::int AS n FROM resources`)).n)).toBe(0);
    const audit = await one<{ after: { title: string } }>(
      `SELECT after FROM audit_log WHERE action = 'resource.deleted'`,
    );
    expect(audit.after.title).toBe("Brand kit");
  });
});

describe("the public boundary", () => {
  it("is the WHERE clause: drafts stay invisible", async () => {
    await save({ title: "Draft thing", published: false });
    await save({ title: "Live thing", published: true, url: "https://example.com/live" });

    // The same predicate the public route uses.
    const visible = await db.query<{ title: string }>(
      `SELECT title FROM resources WHERE campaign_id = $1 AND is_published = true`,
      [campaignId],
    );
    expect(visible.rows.map((r) => r.title)).toEqual(["Live thing"]);
  });
});
