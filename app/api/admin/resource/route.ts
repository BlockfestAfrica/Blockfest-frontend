import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create, edit or delete a pack resource (#70).
 *
 * Owners, because these render on the public pack page under the campaign's
 * name. Plain text only by construction: the renderer escapes, and the
 * function refuses any URL that is not https, since a javascript: href
 * executes in the one place escaping cannot save you.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    id: z.string().uuid().nullable().optional(),
    section: z.string().trim().min(2).max(40),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().max(2000).optional().default(""),
    url: z.string().trim().max(500).optional().default(""),
    displayOrder: z.number().int().min(0).max(999).optional().default(0),
    isPublished: z.boolean().optional().default(false),
  }),
  z.object({ op: z.literal("delete"), id: z.string().uuid() }),
]);

const KNOWN: Array<[string, string, string]> = [
  ["P0912", "title_required", "Give it a title."],
  ["P0913", "section_invalid", "Sections are short lowercase slugs, like pack or faq."],
  ["P0914", "content_required", "A resource needs a body, a link, or both."],
  ["P0915", "url_not_https", "Links have to start with https://."],
  ["P0916", "resource_not_found", "That resource does not exist."],
];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the resource." },
      { status: 400 },
    );
  }
  const c = parsed.data;

  try {
    if (c.op === "delete") {
      await getDb().execute(
        sql`SELECT delete_resource(${c.id}::uuid, ${admin.admin.adminId}::uuid)`,
      );
      return NextResponse.json({ ok: true });
    }

    const result = await getDb().execute(sql`
      SELECT * FROM upsert_resource(
        ${c.id ?? null}::uuid, ${admin.admin.adminId}::uuid, ${MONICA_SLUG}::text,
        ${c.section}::text, ${c.title}::text, ${c.body}::text, ${c.url}::text,
        ${c.displayOrder}::smallint, ${c.isPublished}::boolean
      )
    `);
    const row = (result.rows?.[0] ?? {}) as { resource_id?: string };
    return NextResponse.json({ ok: true, id: row.resource_id ?? null });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("admin/resource", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
