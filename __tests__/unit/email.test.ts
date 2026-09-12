/**
 * The transactional mail layer.
 *
 * Two things are worth testing hard here and neither is the wording.
 *
 * The first is escaping. Creator names and review notes reach these templates
 * straight from a text input, and the output is HTML somebody opens in a mail
 * client. An admin writing a rejection note is trusted to be honest, not
 * trusted to be markup.
 *
 * The second is that a send can never break the thing that triggered it. A
 * registration that committed and then 500s because a mail provider was slow
 * has lost the creator and kept the row.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail, sendEmailQuietly } from "@/lib/email/client";
import {
  approvalEmail,
  firstName,
  personalLink,
  registrationEmail,
  rejectionEmail,
} from "@/lib/email/templates";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ZEPTOMAIL_TOKEN = "test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Capture what would go over the wire, without going over it. */
function captureFetch(response: Partial<Response> = { ok: true }) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => "",
        ...response,
      } as Response;
    }),
  );
  return calls;
}

const body = (calls: { init: RequestInit }[]) =>
  JSON.parse(String(calls[0].init.body));

describe("escaping", () => {
  it("does not put a rejection note into the page as markup", async () => {
    const mail = rejectionEmail({
      to: "c@e.com",
      fullName: "Ada",
      weekNo: 1,
      platformLabel: "X",
      note: `<img src=x onerror="alert(1)"> not your account`,
      personalPage: "https://blockfestafrica.com/p",
      canResubmit: true,
    });

    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
    expect(mail.html).not.toContain("onerror=\"");
  });

  it("does not put a creator's name into the page as markup", () => {
    const mail = approvalEmail({
      to: "c@e.com",
      fullName: `<b>Ada</b> Lovelace`,
      weekNo: 2,
      platformLabel: "TikTok",
      pointsAwarded: 100,
      pointsTotal: 300,
      personalPage: "https://blockfestafrica.com/p",
    });
    expect(mail.html).not.toContain("<b>Ada</b>");
    expect(mail.html).toContain("&lt;b&gt;Ada&lt;/b&gt;");
  });

  it("escapes an ampersand in a name without double-escaping it", () => {
    const mail = approvalEmail({
      to: "c@e.com",
      // One word, because only the first name reaches the greeting.
      fullName: "Tom&Jerry Media",
      weekNo: 1,
      platformLabel: "X",
      pointsAwarded: 100,
      pointsTotal: 100,
      personalPage: "https://blockfestafrica.com/p",
    });
    expect(mail.html).toContain("Tom&amp;Jerry");
    expect(mail.html).not.toContain("&amp;amp;");
  });
});

describe("names", () => {
  it("uses the first name", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
  });

  it("handles somebody who registered with one word", () => {
    expect(firstName("Ada")).toBe("Ada");
  });

  it("never produces an empty greeting", () => {
    expect(firstName("   ")).toBe("there");
  });
});

describe("the personal link", () => {
  it("is built from the configured site, not the incoming request", () => {
    // A registration made on a deploy preview would otherwise email a link to
    // that preview, which stops resolving on the next deploy.
    expect(personalLink("abc")).toBe(
      "https://blockfestafrica.com/campaigns/monica-money-story/enter?t=abc",
    );
  });

  it("encodes the token", () => {
    expect(personalLink("a+b/c")).toContain("t=a%2Bb%2Fc");
  });
});

describe("what goes over the wire", () => {
  it("never turns on click tracking", async () => {
    /*
     * The one that would actually hurt. ZeptoMail click tracking rewrites every
     * href through Zoho's redirector and logs the result, which for the
     * registration email means a creator's bearer credential travelling through
     * a third party and sitting readable in a console.
     */
    const calls = captureFetch();
    await sendEmail(
      registrationEmail({
        to: "c@e.com",
        fullName: "Ada",
        personalLink: personalLink("secret-token"),
        referralCode: "ABCD",
      }),
    );
    expect(body(calls).track_clicks).toBe(false);
    expect(body(calls).track_opens).toBe(false);
  });

  it("sends to the EU endpoint this account lives in", async () => {
    const calls = captureFetch();
    await sendEmail({
      to: "c@e.com",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(calls[0].url).toBe("https://api.zeptomail.eu/v1.1/email");
  });

  it("carries the scheme prefix whether or not the token already has one", async () => {
    for (const stored of ["test-key", "Zoho-enczapikey test-key"]) {
      process.env.ZEPTOMAIL_TOKEN = stored;
      const calls = captureFetch();
      await sendEmail({ to: "c@e.com", subject: "s", html: "h", text: "t" });
      expect(
        (calls[0].init.headers as Record<string, string>).Authorization,
      ).toBe("Zoho-enczapikey test-key");
    }
  });

  it("always sends a plain text alternative", async () => {
    const calls = captureFetch();
    await sendEmail(
      approvalEmail({
        to: "c@e.com",
        fullName: "Ada",
        weekNo: 1,
        platformLabel: "X",
        pointsAwarded: 100,
        pointsTotal: 100,
        personalPage: "p",
      }),
    );
    expect(body(calls).textbody.length).toBeGreaterThan(40);
  });
});

describe("failing without taking the caller down", () => {
  it("does nothing, and says so, when no token is configured", async () => {
    delete process.env.ZEPTOMAIL_TOKEN;
    const calls = captureFetch();
    const result = await sendEmail({
      to: "c@e.com",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(result.sent).toBe(false);
    expect(calls, "nothing attempted").toHaveLength(0);
  });

  it("reports a rejection from the provider rather than throwing", async () => {
    captureFetch({
      ok: false,
      status: 401,
      text: async () => "invalid key",
    });
    const result = await sendEmail({
      to: "c@e.com",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("401");
  });

  it("does not throw when the network is gone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      }),
    );
    await expect(
      sendEmail({ to: "c@e.com", subject: "s", html: "h", text: "t" }),
    ).resolves.toMatchObject({ sent: false });
  });

  it("keeps the key out of anything it reports", async () => {
    // ZeptoMail echoes request detail in some error bodies, and a 400 logged in
    // full is a credential in a log aggregator that outlives the campaign.
    captureFetch({
      ok: false,
      status: 400,
      text: async () =>
        'bad request, header was "Zoho-enczapikey supersecretvalue"',
    });
    const result = await sendEmail({
      to: "c@e.com",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(result.reason).not.toContain("supersecretvalue");
    expect(result.reason).toContain("[redacted]");
  });

  it("sendEmailQuietly resolves even when everything fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      sendEmailQuietly(
        { to: "c@e.com", subject: "s", html: "h", text: "t" },
        "a registration",
      ),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
