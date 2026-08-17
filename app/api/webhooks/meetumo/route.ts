import { NextResponse } from "next/server";
import {
  EVENT_MAP,
  forwardConversion,
  toConversion,
  verifySignature,
  type MeetumoEnvelope,
} from "@/lib/meetumo";

/**
 * POST /api/webhooks/meetumo
 *
 * Ticket sales complete on Meetumo and Paystack, so this is the only way a
 * purchase reaches our analytics. Register the endpoint in Meetumo against the
 * six ticket.* events; everything else it sends is acknowledged and dropped.
 *
 * Runs on Node rather than the edge because signature verification needs
 * node:crypto, and dynamic because a webhook must never be cached or
 * prerendered.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.MEETUMO_WEBHOOK_SECRET;
const WRITE_KEY = process.env.SABILYTICS_WRITE_KEY;

export async function POST(request: Request) {
  if (!SECRET || !WRITE_KEY) {
    // Fail loudly in logs but quietly to the caller: an unconfigured endpoint
    // should not look like a valid one to anybody probing it.
    console.error(
      "[meetumo] not configured:",
      !SECRET ? "MEETUMO_WEBHOOK_SECRET missing" : "SABILYTICS_WRITE_KEY missing"
    );
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // The raw body, byte for byte. Parsing first would break the signature.
  const payload = await request.text();

  const verified = verifySignature({
    payload,
    signature:
      request.headers.get("x-meetumo-signature") ??
      request.headers.get("x-jekapade-signature"),
    timestamp:
      request.headers.get("x-meetumo-timestamp") ??
      request.headers.get("x-jekapade-timestamp"),
    secret: SECRET,
  });

  if (!verified.ok) {
    console.warn("[meetumo] rejected:", verified.reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let envelope: MeetumoEnvelope;
  try {
    envelope = JSON.parse(payload) as MeetumoEnvelope;
  } catch {
    // Signed but unparseable. Retrying will not help, so accept and move on.
    console.warn("[meetumo] signed payload was not JSON");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const conversion = toConversion(envelope);
  if (!conversion) {
    // One of the 40+ event types we did not subscribe to, or an unmapped one.
    return NextResponse.json(
      { received: true, ignored: envelope.event ?? null },
      { status: 200 }
    );
  }

  /**
   * The field names inside `data` are undocumented for ticket events, so log
   * the KEYS on the first purchases to confirm the mapping in lib/meetumo.ts
   * is reading the right ones. Keys only: the values carry buyer names and
   * email addresses and have no business in a log.
   */
  if (conversion.eventName === "ticket_purchased") {
    console.info(
      "[meetumo] ticket.purchased data keys:",
      Object.keys(envelope.data ?? {}).join(", ") || "(none)",
      "| mapped props:",
      Object.keys(conversion.props).join(", ") || "(none)"
    );
  }

  const forwarded = await forwardConversion(conversion, WRITE_KEY);

  if (!forwarded.ok) {
    // Return non-2xx so Meetumo retries. The idempotency key means a duplicate
    // delivery cannot double-count the sale.
    console.error(
      "[meetumo] forward failed:",
      forwarded.status,
      forwarded.body ?? ""
    );
    return NextResponse.json({ error: "forward failed" }, { status: 502 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/** A GET is useful for confirming the route is deployed and configured. */
export function GET() {
  return NextResponse.json({
    endpoint: "meetumo webhook",
    configured: Boolean(SECRET && WRITE_KEY),
    subscribes: Object.keys(EVENT_MAP),
  });
}
