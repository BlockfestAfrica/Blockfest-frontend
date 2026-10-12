import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { DP_ROLES } from "@/app/getdp/lib/dp";
import { DP_CHANNELS } from "@/app/getdp/lib/count";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { allow } from "@/lib/throttle";
import { getDb } from "@/lib/db/client";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One DP made on /getdp: its role and how it left the page, one row each
 * (0072_dp_generations.sql). The admin overview counts them.
 *
 * Public and anonymous, so it is guarded like every public write: same origin
 * only, JSON only, small, and throttled by connection. The limit is generous
 * because a whole office or campus can sit behind one carrier address, and a
 * person making DPs for a team taps many times; it is there to stop a script
 * inflating the count, not to ration anyone.
 */

const schema = z.object({
  role: z.enum(DP_ROLES as unknown as [string, ...string[]]),
  channel: z.enum(DP_CHANNELS),
});

/** A role and a channel are a few dozen bytes. */
const MAX_BODY_BYTES = 512;
const COUNT_LIMIT_PER_HOUR = 240;

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("Not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return fail("We could not read that. Please try again.", 415);
  }
  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) return fail("We could not read that. Please try again.", 400);
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return fail("That is not a DP we can count.", 400);

  // After the checks above, so a refused request spends nothing.
  if (!(await allow(request, "getdp-generated", COUNT_LIMIT_PER_HOUR, 3600))) {
    return fail("That is a lot of DPs from one place. Wait a while and try again.", 429);
  }

  try {
    await getDb().execute(
      sql`INSERT INTO dp_generations (role, channel) VALUES (${parsed.data.role}, ${parsed.data.channel})`,
    );
  } catch (error) {
    logError("getdp count", error);
    return fail("Something went wrong at our end. Please try again.", 500);
  }
  return NextResponse.json({ ok: true });
}
