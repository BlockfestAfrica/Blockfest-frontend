import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin, throttleKey } from "@/lib/admin/request";
import { claimRovvNotice, markRovvNotified, releaseRovvNotice, rovvTestWinner } from "@/lib/admin/rovv";
import { sendEmail } from "@/lib/email/client";
import { rovvWinnerEmail } from "@/lib/email/templates";
import { allowKeyStrict } from "@/lib/throttle";
import { ticketUrl } from "@/lib/tickets";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send the winner email to ONE test winner, now (0074).
 *
 * So the owner can see the real winner email, code and all, before entries
 * have even opened. Only a test entry, picked, with a code, not yet emailed;
 * a real winner is never reachable from here, and the real "Email the
 * winners" keeps its wait for the close. One message to one address the
 * tester typed, so it is not a bulk send and carries no owner copy.
 */
const schema = z.object({ entryId: z.string().uuid("That is not an entry.") });

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  if (!(await allowKeyStrict(throttleKey(request), "admin-rovv-test-notify", 10, 3600))) {
    return NextResponse.json(
      { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "That is not an entry." }, { status: 400 });

  try {
    const listed = await rovvTestWinner(admin.admin, parsed.data.entryId);
    if (!listed) {
      return NextResponse.json(
        {
          ok: false,
          message: "Only a test entry that is picked as a winner, has a code and has not been emailed can be sent this.",
        },
        { status: 409 },
      );
    }
    // The row as claimed, so the code mailed is the one now locked in.
    const winner = await claimRovvNotice(admin.admin, listed);
    if (!winner) {
      return NextResponse.json({ ok: false, message: "This one is being sent right now." }, { status: 409 });
    }

    const result = await sendEmail(
      rovvWinnerEmail({
        to: winner.email,
        fullName: winner.fullName,
        tiktokUrl: winner.tiktokUrl,
        ticketCode: winner.ticketCode,
        ticketLink: ticketUrl("rovv winner email"),
      }),
    );
    if (!result.sent) {
      await releaseRovvNotice(admin.admin, winner.id).catch((error) => logError("admin/rovv test-notify release", error));
      return NextResponse.json(
        { ok: false, message: `The email did not send (${result.reason ?? "unknown"}).` },
        { status: 502 },
      );
    }
    await markRovvNotified(admin.admin, winner.id);
    return NextResponse.json({ ok: true, sentTo: winner.email });
  } catch (error) {
    logError("admin/rovv test-notify", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
