import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { allow } from "@/lib/throttle";
import { stopByToken } from "@/lib/email-stop";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The button on the "stop these emails" page (lib/email-stop.ts).
 *
 * Public, because the person pressing it is a creator holding a link, not a
 * session. The token is the whole permission, and the most it can do is
 * withdraw one person's marketing consent, so the throttle fails open like
 * every other limit on a route that sends nothing.
 *
 * Same origin and JSON only, as the register route is: a cross-site
 * text/plain form would otherwise be read here as JSON.
 */
const schema = z.object({ t: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
  }
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 415 });
  }

  const read = await readJsonBody(request, 1024);
  const parsed = read.ok ? schema.safeParse(read.body) : null;
  if (!parsed?.success) {
    return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  }

  if (!(await allow(request, "stop-emails", 30, 3600))) {
    return NextResponse.json(
      { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  try {
    return NextResponse.json({ ok: true, outcome: await stopByToken(parsed.data.t) });
  } catch (error) {
    logError("campaigns/monica/stop-emails", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
