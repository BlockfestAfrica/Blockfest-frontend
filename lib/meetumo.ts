import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meetumo webhooks, and how they become Sabilytics conversions.
 *
 * Payment happens on Meetumo and then Paystack, so the site never sees the
 * purchase. This is the only path by which a sale reaches our analytics.
 *
 * One thing to be clear about, because it shapes everything here: Meetumo
 * cannot tell us which campaign produced a sale. Their checkout sends a closed
 * set of fields and the argument validator rejects anything else, the Paystack
 * URL is generated server-side, and no part of their app reads the utm_* or
 * sb_vid params we attach to the outbound link. So conversions are posted
 * without a visitorId and land as direct. Revenue and volume are real; the
 * campaign breakdown is not available until Meetumo exposes either the
 * posthogDistinctId already on their order, or a metadata passthrough.
 */

/** Signatures older than this are rejected, per Meetumo's own guidance. */
const MAX_AGE_MS = 5 * 60 * 1000;

/** Meetumo wants a response inside 5s, so leave room to answer after this. */
export const FORWARD_TIMEOUT_MS = 3500;

/** Overridable only so the route can be exercised against a local receiver. */
export const SABILYTICS_CONVERSIONS_URL =
  process.env.SABILYTICS_CONVERSIONS_URL ??
  "https://www.sabilytics.com/api/v1/conversions";

/**
 * Ticket events we act on, and the Sabilytics event each becomes.
 *
 * Only ticket_purchased is the goal. The rest are posted under their own names
 * so refunds and cancellations are visible without being counted as sales.
 * Meetumo sends 40+ event types; anything not listed is acknowledged and
 * ignored rather than forwarded.
 */
export const EVENT_MAP: Record<string, string> = {
  "ticket.purchased": "ticket_purchased",
  "ticket.refunded": "ticket_refunded",
  "ticket.partially_refunded": "ticket_partially_refunded",
  "ticket.cancelled": "ticket_cancelled",
  "ticket.transferred": "ticket_transferred",
  "ticket.checked_in": "ticket_checked_in",
};

export interface MeetumoEnvelope {
  id?: string;
  event?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}

/**
 * Verify a Meetumo signature.
 *
 * HMAC-SHA256 over `timestamp.payload`, compared in constant time. Returns a
 * reason rather than a bare false so a rejection can be diagnosed from logs
 * without echoing the signature back to the caller.
 */
export function verifySignature({
  payload,
  signature,
  timestamp,
  secret,
  now = Date.now(),
}: {
  payload: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!signature) return { ok: false, reason: "missing signature" };
  if (!timestamp) return { ok: false, reason: "missing timestamp" };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "unparseable timestamp" };
  if (ts < now - MAX_AGE_MS) return { ok: false, reason: "timestamp too old" };
  // A timestamp from the future is as suspect as one from the past.
  if (ts > now + MAX_AGE_MS) return { ok: false, reason: "timestamp in future" };

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a leak of
  // sorts, so compare lengths first and return the same generic reason.
  if (given.length !== want.length) return { ok: false, reason: "signature mismatch" };
  if (!timingSafeEqual(given, want)) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}

/** Read a number from any of several candidate keys. */
function pickNumber(
  source: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Read a non-empty string from any of several candidate keys. */
function pickString(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

export interface ConversionPayload {
  eventName: string;
  props: Record<string, string | number | boolean | null>;
  idempotencyKey: string;
}

/**
 * Turn a verified envelope into something Sabilytics accepts.
 *
 * Meetumo publishes a payload example for community.member.joined only, never
 * for ticket.purchased, so the field names for amount, currency and tier are
 * not documented. Rather than guess one name and silently record nothing, each
 * value is read from a list of plausible keys and simply omitted when absent:
 * a conversion without a value is still a sale, and dropping the whole event
 * because a price could not be found would be worse. Correct the lists below
 * once a real payload has been seen.
 *
 * Amounts are assumed to be major units. If Meetumo sends kobo, revenue will
 * read 100x high, which is exactly the sort of thing the first live purchase
 * should be checked for.
 */
export function toConversion(
  envelope: MeetumoEnvelope
): ConversionPayload | null {
  const eventName = envelope.event ? EVENT_MAP[envelope.event] : undefined;
  if (!eventName) return null;

  const data = (envelope.data ?? {}) as Record<string, unknown>;

  const props: Record<string, string | number | boolean | null> = {};

  const pass = pickString(data, [
    "ticketTier",
    "tierName",
    "ticket_type",
    "ticketType",
    "tier",
  ]);
  if (pass) props.pass = pass;

  const quantity = pickNumber(data, ["quantity", "ticketCount", "count"]);
  if (quantity !== undefined) props.quantity = quantity;

  // Money only belongs on the events where money moved.
  if (eventName === "ticket_purchased" || eventName.includes("refunded")) {
    const value = pickNumber(data, [
      "amount",
      "total",
      "totalAmount",
      "amountPaid",
      "price",
    ]);
    if (value !== undefined) props.value = value;

    const currency = pickString(data, ["currency", "currencyCode"]);
    props.currency = currency ?? "NGN";
  }

  const orderId = pickString(data, ["orderId", "order_id", "id", "ticketId"]);
  if (orderId) props.order_id = orderId;

  return {
    eventName,
    props,
    /**
     * Meetumo retries, so every delivery must be safe to replay. Their
     * delivery id is unique per attempt-set and is the right key; the order id
     * is the fallback, and the two are combined so a refund of an order cannot
     * collide with its purchase.
     */
    idempotencyKey: envelope.id ?? `${eventName}:${orderId ?? "unknown"}`,
  };
}

/**
 * Send a conversion to Sabilytics.
 *
 * No visitorId is sent, because Meetumo does not carry one. The call is
 * bounded so a slow analytics endpoint cannot push us past the 5s Meetumo
 * allows for a response.
 */
export async function forwardConversion(
  conversion: ConversionPayload,
  writeKey: string,
  timeoutMs = FORWARD_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; body?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(SABILYTICS_CONVERSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(conversion),
      signal: controller.signal,
    });
    return {
      ok: res.ok,
      status: res.status,
      body: res.ok ? undefined : (await res.text()).slice(0, 300),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error instanceof Error ? error.message : "forward failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
