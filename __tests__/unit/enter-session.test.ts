/**
 * Clicking a link must not sign anybody in.
 *
 * This route set a ninety day session cookie for any 43 URL safe characters,
 * without asking the database whether the token belonged to anybody. A link was
 * therefore a login, and a link can be forwarded. An attacker posting their own
 * link into the campaign group chat captioned "open your dashboard here" would
 * have every creator who tapped it silently carrying the attacker's session,
 * filing their own week's work into the attacker's account.
 *
 * The tests below are mostly about what no longer happens.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID = "dAyeo84EfDrV3h3E7NVYQx5MlMNqrA_5nrMofYmz3o8";
const OTHER = "Zk3Qm9WcJt7Lx2Nv5Rb8Ys1Pd4Hg6Ue0Ai3Oq7Kw2Mz";

/** The session cookie, and the name it had before the __Host- prefix. */
const SESSION = "__Host-monica_creator";
const LEGACY = "monica_creator";

const resolve = vi.fn();

vi.mock("@/lib/creator-session", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/creator-session",
  );
  return {
    ...actual,
    creatorByToken: (token: string) => resolve(token),
    sessionCookieOptions: () => ({ httpOnly: true, path: "/", maxAge: 100 }),
    // The real path, not a stand-in. The helper below refuses to count a
    // clearing Set-Cookie whose Path a browser would not match, so a mock
    // with a fake path would fail correct code.
    pendingCookieOptions: () => ({
      httpOnly: true,
      path: "/campaigns/monica-money-story/enter",
      maxAge: 10,
    }),
  };
});

async function enter(
  token: string,
  cookies: Record<string, string> = {},
): Promise<Response> {
  const { GET } = await import(
    "@/app/campaigns/monica-money-story/enter/route"
  );
  const url = `https://blockfestafrica.com/campaigns/monica-money-story/enter?t=${token}`;
  const request = new Request(url, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
  });
  // NextRequest wraps Request; the route reads nextUrl and cookies, both of
  // which NextRequest derives from the Request it is given.
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(request));
}

/**
 * Set-Cookie, split into what was set and what was cleared.
 *
 * A deletion is also a Set-Cookie header, with an empty value and Max-Age=0.
 * Reading the two as the same thing had this suite assert that a cleared cookie
 * was a set one, which is the opposite of what the route does.
 */
function cookiesOn(response: Response): {
  set: Record<string, string>;
  deleted: string[];
} {
  const set: Record<string, string> = {};
  const deleted: string[] = [];

  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attributes] = raw.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    const path = attributes
      .map((a) => /^\s*path\s*=\s*(.+)$/i.exec(a)?.[1]?.trim())
      .find(Boolean);

    const clearing =
      value === "" ||
      attributes.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a));

    if (clearing) {
      /*
       * A clearing Set-Cookie only clears the cookie whose Path matches. The
       * first version of this helper classified by name alone, and passed a
       * clear that every real browser ignored: the pending cookie is set
       * path-scoped to the entry route, and delete() without options emits
       * Path=/, which matches nothing. A delete only counts here if a browser
       * would actually honour it.
       */
      const expected: Record<string, string> = {
        monica_pending: "/campaigns/monica-money-story/enter",
      };
      const wanted = expected[name];
      if (!wanted || path === wanted) deleted.push(name);
    } else {
      set[name] = value;
    }
  }

  return { set, deleted };
}

/** Just the cookies actually established, which is what most assertions mean. */
const setCookies = (response: Response) => cookiesOn(response).set;

beforeEach(() => {
  resolve.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("a link that belongs to nobody", () => {
  it("sets no session, however well formed it looks", async () => {
    resolve.mockResolvedValue(null);
    const response = await enter(VALID);

    expect(
      setCookies(response)[SESSION],
      "a well formed but unknown token used to be enough to sign in",
    ).toBeUndefined();
  });

  it("says so, rather than dropping the creator on a dashboard that disowns them", async () => {
    resolve.mockResolvedValue(null);
    const response = await enter(VALID);
    expect(response.headers.get("location")).toContain("s=unknown");
  });

  it("clears any half finished claim on the way past", async () => {
    resolve.mockResolvedValue(null);
    expect(cookiesOn(await enter(VALID)).deleted).toContain("monica_pending");
  });

  it("refuses a malformed token", async () => {
    resolve.mockResolvedValue(null);
    const response = await enter("short");
    expect(setCookies(response)[SESSION]).toBeUndefined();
    expect(setCookies(response).monica_pending).toBeUndefined();
  });
});

describe("a link that does belong to somebody", () => {
  /**
   * The heart of it. A valid token is a claim, not a session. Nothing a person
   * can be made to do by tapping a link establishes one.
   */
  it("still does not sign them in", async () => {
    resolve.mockResolvedValue({ enrolmentId: "e1", name: "Ada N." });
    const response = await enter(VALID);

    const cookies = setCookies(response);
    expect(cookies[SESSION], "no session from a GET").toBeUndefined();
    expect(cookies.monica_pending, "the claim is parked instead").toBe(VALID);
  });

  it("sends them to be asked whose account it is", async () => {
    resolve.mockResolvedValue({ enrolmentId: "e1", name: "Ada N." });
    const response = await enter(VALID);
    // With an explicit query: a query-less Location gets the ORIGINAL query,
    // token included, re-appended by Netlify.
    expect(response.headers.get("location")).toBe(
      "/campaigns/monica-money-story/enter/confirm?s=go",
    );
  });

  /**
   * The attack, end to end. The victim is signed in as themselves and taps the
   * attacker's link. What must not happen is the swap happening quietly.
   */
  it("does not swap an existing session for a different one", async () => {
    resolve.mockResolvedValue({ enrolmentId: "attacker", name: "Chidi O." });
    const response = await enter(OTHER, { [SESSION]: VALID });

    expect(
      setCookies(response)[SESSION],
      "the victim's own session must survive a tap on somebody else's link",
    ).toBeUndefined();
  });
});

describe("the creator who clicks their own link again", () => {
  /**
   * The common case on a second device and on every re-read of the welcome
   * email. A confirmation here would be friction that protects nobody, since
   * they already hold this exact session.
   */
  it("goes straight through", async () => {
    resolve.mockResolvedValue({ enrolmentId: "e1", name: "Ada N." });
    const response = await enter(VALID, { [SESSION]: VALID });

    // The explicit query keeps Netlify from re-appending ?t= to the one URL
    // a signed-in creator lands on with their token still in hand.
    expect(response.headers.get("location")).toBe(
      "/campaigns/monica-money-story/me?s=go",
    );
    expect(setCookies(response)[SESSION]).toBe(VALID);
  });

  /**
   * Not for the name a sibling host can plant. A planted token sent out with
   * its own matching link would otherwise skip the one page that names the
   * account, and the old cookie cannot be told from a planted one. A creator
   * still on it is asked once, the same as any link.
   */
  it("is asked once if all they hold is the pre-prefix cookie", async () => {
    resolve.mockResolvedValue({ enrolmentId: "e1", name: "Ada N." });
    const response = await enter(VALID, { [LEGACY]: VALID });

    expect(response.headers.get("location")).toBe(
      "/campaigns/monica-money-story/enter/confirm?s=go",
    );
    expect(setCookies(response)[SESSION]).toBeUndefined();
    expect(setCookies(response).monica_pending).toBe(VALID);
  });
});

describe("when the database cannot be reached", () => {
  /**
   * Telling a creator their link is invalid sends them hunting for a new one
   * and into the support inbox. A blip is not a bad link and must not read as
   * one.
   */
  it("does not call a working link invalid", async () => {
    resolve.mockRejectedValue(new Error("connection reset"));
    const response = await enter(VALID);

    expect(response.headers.get("location")).toContain("s=unavailable");
    expect(response.headers.get("location")).not.toContain("s=unknown");
  });

  it("still sets no session", async () => {
    resolve.mockRejectedValue(new Error("connection reset"));
    expect(setCookies(await enter(VALID))[SESSION]).toBeUndefined();
  });
});

/**
 * Where the "never becomes a query" guarantee actually lives.
 *
 * The route hands every value to creatorByToken rather than pre-checking the
 * shape itself, so there is one entry point and no second copy of the rule to
 * drift. That is only safe while creatorByToken refuses a malformed value
 * before it touches the database, which is what this asserts against the real
 * function rather than the mock used above.
 */
describe("resolving a token", () => {
  it("does not query for a value that is not the shape we mint", async () => {
    vi.resetModules();
    const select = vi.fn();
    vi.doMock("@/lib/db/client", () => ({
      getDb: () => ({ select }),
      campaignCreators: {},
      campaigns: {},
      challengeEntries: {},
      challenges: {},
      creatorSocialHandles: {},
      creators: {},
      pointLedger: {},
      submissions: {},
    }));

    const real = await vi.importActual<typeof import("@/lib/creator-session")>(
      "@/lib/creator-session",
    );

    for (const bad of ["", "short", "!".repeat(43), `${VALID}x`, " ".repeat(43)]) {
      await expect(real.creatorByToken(bad)).resolves.toBeNull();
    }
    expect(select, "a malformed value never becomes a query").not.toHaveBeenCalled();

    // And the shape we do mint gets through to the query.
    await real.creatorByToken(VALID).catch(() => null);
    expect(select).toHaveBeenCalled();
  });
});
