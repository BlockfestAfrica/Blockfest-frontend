/**
 * Tests for the Meetumo webhook.
 *
 * This endpoint is public and takes money-shaped data from the internet, so
 * the signature check is the only thing standing between a stranger and our
 * revenue numbers. It is tested harder than anything else here.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EVENT_MAP,
  toConversion,
  verifySignature,
} from "@/lib/meetumo";

const SECRET = "whsec_test_secret_value";

function sign(payload: string, timestamp: number, secret = SECRET) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

function purchase(data: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "whd_abc123",
    event: "ticket.purchased",
    timestamp: 1735700000000,
    data: {
      orderId: "ord_9",
      ticketTier: "BRIDGE PASS",
      quantity: 2,
      amount: 15000,
      currency: "NGN",
      attendeeEmail: "buyer@example.com",
      ...data,
    },
  });
}

describe("verifySignature", () => {
  const now = 1735700000000;

  it("accepts a correctly signed payload", () => {
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, now),
      timestamp: String(now),
      secret: SECRET,
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, now, "whsec_not_our_secret"),
      timestamp: String(now),
      secret: SECRET,
      now,
    });
    expect(r).toEqual({ ok: false, reason: "signature mismatch" });
  });

  it("rejects a payload whose body was altered after signing", () => {
    // The exact attack the signature exists to stop: a real delivery replayed
    // with the amount inflated.
    const original = purchase({ amount: 15000 });
    const signature = sign(original, now);
    const tampered = purchase({ amount: 999999 });
    const r = verifySignature({
      payload: tampered,
      signature,
      timestamp: String(now),
      secret: SECRET,
      now,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when the timestamp is not the one that was signed", () => {
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, now),
      timestamp: String(now + 1000),
      secret: SECRET,
      now,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a replay older than five minutes", () => {
    const old = now - 6 * 60 * 1000;
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, old),
      timestamp: String(old),
      secret: SECRET,
      now,
    });
    expect(r).toEqual({ ok: false, reason: "timestamp too old" });
  });

  it("accepts one just inside the five minute window", () => {
    const recent = now - 4 * 60 * 1000;
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, recent),
      timestamp: String(recent),
      secret: SECRET,
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a timestamp from the future", () => {
    const future = now + 10 * 60 * 1000;
    const body = purchase();
    const r = verifySignature({
      payload: body,
      signature: sign(body, future),
      timestamp: String(future),
      secret: SECRET,
      now,
    });
    expect(r).toEqual({ ok: false, reason: "timestamp in future" });
  });

  it("rejects missing or unparseable headers rather than throwing", () => {
    const body = purchase();
    expect(
      verifySignature({ payload: body, signature: null, timestamp: String(now), secret: SECRET, now })
    ).toEqual({ ok: false, reason: "missing signature" });
    expect(
      verifySignature({ payload: body, signature: sign(body, now), timestamp: null, secret: SECRET, now })
    ).toEqual({ ok: false, reason: "missing timestamp" });
    expect(
      verifySignature({ payload: body, signature: sign(body, now), timestamp: "not-a-number", secret: SECRET, now })
    ).toEqual({ ok: false, reason: "unparseable timestamp" });
  });

  it("does not throw on a signature of the wrong length", () => {
    // timingSafeEqual throws when buffers differ in length; a short signature
    // must be a rejection, not a 500.
    const body = purchase();
    expect(() =>
      verifySignature({ payload: body, signature: "abc", timestamp: String(now), secret: SECRET, now })
    ).not.toThrow();
    expect(
      verifySignature({ payload: body, signature: "abc", timestamp: String(now), secret: SECRET, now }).ok
    ).toBe(false);
  });
});

describe("toConversion", () => {
  it("maps a purchase to the goal event with money attached", () => {
    const c = toConversion(JSON.parse(purchase()));
    expect(c?.eventName).toBe("ticket_purchased");
    expect(c?.props).toMatchObject({
      pass: "BRIDGE PASS",
      quantity: 2,
      value: 15000,
      currency: "NGN",
      order_id: "ord_9",
    });
  });

  it("uses the delivery id as the idempotency key, so retries cannot double count", () => {
    const c = toConversion(JSON.parse(purchase()));
    expect(c?.idempotencyKey).toBe("whd_abc123");
  });

  it("falls back to an event-scoped key when there is no delivery id", () => {
    const env = JSON.parse(purchase());
    delete env.id;
    const c = toConversion(env);
    // Scoped by event so a refund of an order cannot collide with its purchase.
    expect(c?.idempotencyKey).toBe("ticket_purchased:ord_9");
  });

  it("still records the sale when the amount field is named something else", () => {
    // The ticket.purchased shape is undocumented, so missing money must not
    // discard the conversion.
    const env = JSON.parse(purchase());
    delete env.data.amount;
    const c = toConversion(env);
    expect(c?.eventName).toBe("ticket_purchased");
    expect(c?.props.value).toBeUndefined();
    expect(c?.props.order_id).toBe("ord_9");
  });

  it("reads alternative field names for amount and tier", () => {
    const c = toConversion({
      id: "whd_1",
      event: "ticket.purchased",
      data: { totalAmount: "26250", tierName: "BECOME PASS", currencyCode: "NGN" },
    });
    expect(c?.props).toMatchObject({ value: 26250, pass: "BECOME PASS", currency: "NGN" });
  });

  it("defaults currency to NGN, which is what the site prices in", () => {
    const env = JSON.parse(purchase());
    delete env.data.currency;
    expect(toConversion(env)?.props.currency).toBe("NGN");
  });

  it("keeps money off events where no money moved", () => {
    const c = toConversion({ id: "whd_2", event: "ticket.checked_in", data: { amount: 15000 } });
    expect(c?.eventName).toBe("ticket_checked_in");
    expect(c?.props.value).toBeUndefined();
    expect(c?.props.currency).toBeUndefined();
  });

  it("gives refunds their own event so they are not counted as sales", () => {
    expect(toConversion({ id: "a", event: "ticket.refunded", data: {} })?.eventName)
      .toBe("ticket_refunded");
    expect(toConversion({ id: "b", event: "ticket.partially_refunded", data: {} })?.eventName)
      .toBe("ticket_partially_refunded");
    expect(toConversion({ id: "c", event: "ticket.cancelled", data: {} })?.eventName)
      .toBe("ticket_cancelled");
  });

  it("ignores the events we do not subscribe to", () => {
    for (const event of ["event.published", "community.member.joined", "lead.captured", "broadcast.sent"]) {
      expect(toConversion({ id: "x", event, data: {} })).toBeNull();
    }
    expect(toConversion({})).toBeNull();
  });

  it("emits only flat primitives, which is all Sabilytics accepts", () => {
    const c = toConversion(JSON.parse(purchase({ nested: { a: 1 }, list: [1, 2] })));
    for (const value of Object.values(c?.props ?? {})) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
  });

  it("does not forward the buyer's personal details", () => {
    const c = toConversion(JSON.parse(purchase()));
    const serialised = JSON.stringify(c?.props);
    expect(serialised).not.toContain("buyer@example.com");
    expect(serialised.toLowerCase()).not.toContain("email");
  });

  it("uses snake_case names within the 64 character limit", () => {
    for (const name of Object.values(EVENT_MAP)) {
      expect(name).toMatch(/^[a-z0-9_]+$/);
      expect(name.length).toBeLessThanOrEqual(64);
    }
  });
});
