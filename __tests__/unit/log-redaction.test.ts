/**
 * Nothing personal reaches a function log.
 *
 * Function logs are read in a dashboard, retained by the platform, and outlive
 * the request by a long way. This campaign holds a name, an email address and a
 * phone number for every registrant under the NDPA, and it has already had one
 * incident involving registrant data, so this is not a hypothetical cost.
 *
 * The interesting assertions are the ones about what survives. A redactor that
 * eats the SQLSTATE and the constraint name protects nobody and blinds the
 * person on call, so they would take it out again within a week.
 */

import { describe, expect, it, vi } from "vitest";
import { redactPii, logError } from "@/lib/log";

const EMAIL = "ada.lovelace+monica@example.com";
const PHONE = "+2348012345678";
const TOKEN = "dAyeo84EfDrV3h3E7NVYQx5MlMNqrA_5nrMofYmz3o8";

describe("what must never appear", () => {
  it("removes an email address", () => {
    const out = redactPii(`duplicate key (email_canonical)=(${EMAIL}) exists`);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain("ada.lovelace");
    expect(out).toContain("[email]");
  });

  it("removes an IPv4 address, so a throttle bucket cannot leak one", () => {
    // A throttle bucket is name:<client-ip>, and Drizzle's error message
    // embeds the bound params. A client IP is NDPA personal data.
    expect(redactPii("throttle enter:102.89.33.4 failed")).not.toContain(
      "102.89.33.4",
    );
    expect(redactPii("register:41.58.128.9,300,3600")).toContain("[ip]");
  });

  it("keeps a version-like number that is not an address", () => {
    // The rule needs four octets; a UUID or a short dotted number survives.
    expect(redactPii("schema 15.5.25 ok")).toContain("15.5.25");
  });

  it("removes a phone number", () => {
    expect(redactPii(`Key (phone_e164)=(${PHONE}) already exists`)).not.toContain(
      PHONE,
    );
  });

  it("removes a local phone number as typed", () => {
    expect(redactPii("phone 08012345678 taken")).toContain("[phone]");
  });

  it("removes an access token", () => {
    // The worst one: it is not personal data, it is a live 90 day credential.
    expect(redactPii(`?t=${TOKEN} failed`)).not.toContain(TOKEN);
  });

  it("removes a token that starts or ends with a hyphen", () => {
    // Base64url index 62 is '-', so about one minted token in thirty starts
    // or ends with one, and \b does not treat '-' as a word boundary. The
    // first version of this redactor missed exactly those.
    const leading = "-" + TOKEN.slice(1);
    const trailing = TOKEN.slice(0, 42) + "-";
    expect(redactPii(`t=${leading} failed`)).not.toContain(leading);
    expect(redactPii(`t=${trailing} failed`)).not.toContain(trailing);
  });

  it("removes the mail provider key", () => {
    expect(redactPii("Authorization: Zoho-enczapikey ABC123xyz")).not.toContain(
      "ABC123xyz",
    );
  });

  it("removes a recipient echoed by a mail provider error body", () => {
    // ZeptoMail 4xx bodies echo the address they could not deliver to, and the
    // client's old redact() stripped only the API key.
    const body = `{"error":{"details":[{"target":"${EMAIL}","message":"invalid"}]}}`;
    expect(redactPii(body)).not.toContain(EMAIL);
  });

  it("removes every address when there are several", () => {
    const out = redactPii(`from a@b.com to c@d.org cc e@f.net`);
    expect(out).not.toMatch(/@(b\.com|d\.org|f\.net)/);
  });
});

describe("what must survive, so the log is still worth reading", () => {
  it("keeps the SQLSTATE", () => {
    expect(redactPii("P0209 wrong_account")).toContain("P0209");
  });

  it("keeps the constraint name, which is often the only thing that says which rule fired", () => {
    expect(
      redactPii('violates unique constraint "submission_identity_unique_active"'),
    ).toContain("submission_identity_unique_active");
  });

  it("keeps a uuid, which is how a row is found again", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(redactPii(`enrolment ${id} not found`)).toContain(id);
  });

  it("keeps ordinary prose and small numbers", () => {
    expect(redactPii("would_go_negative: holds 50")).toBe(
      "would_go_negative: holds 50",
    );
  });
});

describe("logError", () => {
  it("emits the code and a redacted message, and nothing else", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error(`Key (email_canonical)=(${EMAIL}) already exists`),
      { code: "23505" },
    );

    logError("campaign/register", error);

    const line = spy.mock.calls[0].join(" ");
    expect(line).toContain("23505");
    expect(line).not.toContain(EMAIL);
    spy.mockRestore();
  });

  it("never passes the error object itself, which would print its own fields", () => {
    // A NeonDbError carries .query and .parameters. console.error given the
    // object prints them; given a string it cannot.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("boom"), {
      code: "23505",
      query: "INSERT INTO creators (email) VALUES ($1)",
      parameters: [EMAIL],
    });

    logError("x", error);

    for (const argument of spy.mock.calls[0]) {
      expect(typeof argument, "only strings reach the log").toBe("string");
    }
    expect(spy.mock.calls[0].join(" ")).not.toContain("INSERT INTO");
    spy.mockRestore();
  });
});

describe("the quiet email failure line", () => {
  /**
   * The residual the issue-closure verification found on #145: the sink
   * redacted the provider's reason and trusted the caller's context label,
   * and the register route was passing the creator's address inside it. The
   * whole line goes through the redactor now, exercised through the real
   * function on its no-token path so no network is involved.
   */
  it("redacts the context label, not only the reason", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = process.env.ZEPTOMAIL_TOKEN;
    delete process.env.ZEPTOMAIL_TOKEN;

    try {
      vi.resetModules();
      const { sendEmailQuietly } = await import("@/lib/email/client");
      await sendEmailQuietly(
        {
          to: "ada@example.com",
          subject: "x",
          html: "<p>x</p>",
          text: "x",
        } as never,
        "registration for ada.lovelace@example.com",
      );

      const written = spy.mock.calls.flat().join(" ");
      expect(written, "the failure is still reported").toContain("not sent");
      expect(written).not.toContain("ada.lovelace@example.com");
      expect(written).toContain("[email]");
    } finally {
      if (token !== undefined) process.env.ZEPTOMAIL_TOKEN = token;
      spy.mockRestore();
    }
  });
});
