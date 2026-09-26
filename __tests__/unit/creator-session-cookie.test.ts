/**
 * The creator session cookie, and what a browser lets somebody else put in
 * its place.
 *
 * The session rode under a plain name, monica_creator. Any host under the
 * registrable domain could set that name with a Domain attribute, and so could
 * anybody on the network over plain HTTP against a first visit, and the server
 * cannot tell who wrote a cookie: a Cookie header carries names and values and
 * nothing else. A planted value that was an attacker's own token signed the
 * victim into the attacker's enrolment without passing the confirm page, and
 * the victim's Instagram entry was filed as the attacker's work.
 *
 * The admin cookie closed the same door with __Host- (#138). These pin the
 * creator's: the prefix and the attributes it demands, that only the prefixed
 * cookie is a session, that two values under one name are none, and that a
 * creator still holding the old name is asked once by name rather than signed
 * out mid-campaign or, worse, silently carried over.
 *
 * Cookies are read through Next's own request parser and written through its
 * own response cookies, so what is asserted is the header a browser would get,
 * not the shape of a call.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const MINE = "dAyeo84EfDrV3h3E7NVYQx5MlMNqrA_5nrMofYmz3o8";
const PLANTED = "Zk3Qm9WcJt7Lx2Nv5Rb8Ys1Pd4Hg6Ue0Ai3Oq7Kw2Mz";

const HOST = "__Host-monica_creator";
const LEGACY = "monica_creator";
const PENDING = "monica_pending";

/** The Cookie header the next call sees, exactly as a browser would send it. */
let cookieHeader = "";
/** Where the code under test writes its Set-Cookie headers. */
let written: NextResponse;
/** Every token the session lookup hashed, in order: one per database query. */
const looked: string[] = [];
const resolve = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ cookie: cookieHeader, "x-nf-client-connection-ip": "1.2.3.4" }),
  cookies: async () => {
    const incoming = new NextRequest("https://blockfestafrica.com/", {
      headers: { cookie: cookieHeader },
    }).cookies;
    return {
      get: (name: string) => incoming.get(name),
      set: (...args: Parameters<NextResponse["cookies"]["set"]>) =>
        written.cookies.set(...args),
      delete: (...args: Parameters<NextResponse["cookies"]["delete"]>) =>
        written.cookies.delete(...args),
    };
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

vi.mock("@/lib/throttle", () => ({ allowKey: async () => true }));

vi.mock("@/lib/creator-access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/creator-access")>(
    "@/lib/creator-access",
  );
  return {
    ...actual,
    hashAccessToken: (token: string) => {
      looked.push(token);
      return actual.hashAccessToken(token);
    },
  };
});

const ROW = {
  enrolmentId: "e-mine",
  name: "Ada N.",
  referralCode: "ADA1",
  pointsTotal: 0,
  approvedEntries: 0,
  joinedAt: new Date("2026-09-14T00:00:00Z"),
};

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/db/client");
  // Every drizzle step hands back the chain, and the last one answers with a
  // row, so whichever token reaches the lookup is visibly treated as a session.
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "innerJoin", "where"]) chain[step] = () => chain;
  chain.limit = async () => [ROW];
  return { ...actual, getDb: () => ({ select: () => chain }) };
});

vi.mock("@/lib/creator-session", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/creator-session",
  );
  return { ...actual, creatorByToken: (token: string) => resolve(token) };
});

beforeEach(() => {
  cookieHeader = "";
  written = NextResponse.json({});
  looked.length = 0;
  resolve.mockReset();
  resolve.mockImplementation(async (token: string) =>
    token === MINE ? { enrolmentId: "e-mine", name: "Ada N." } : null,
  );
});

/**
 * What a browser does with the Set-Cookie headers written, per name: the value
 * it now holds, or "" for cleared. A Set-Cookie the browser would refuse, which
 * for a __Host- name is any without Secure and Path=/ or with a Domain, is
 * dropped, deletions included: a sign-out whose clear is refused is no
 * sign-out.
 */
function browserSees(): Record<string, string> {
  const held: Record<string, string> = {};
  for (const raw of written.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";").map((part) => part.trim());
    const at = pair.indexOf("=");
    const name = pair.slice(0, at);
    const value = pair.slice(at + 1);
    const attr = (key: string) =>
      attrs.find((a) => a.toLowerCase().split("=")[0] === key);
    if (name.startsWith("__Host-")) {
      const refused =
        !attr("secure") || attr("path") !== "Path=/" || attr("domain");
      if (refused) continue;
    }
    const clearing =
      value === "" ||
      /^max-age=0$/i.test(attr("max-age") ?? "") ||
      /1970/.test(attr("expires") ?? "");
    held[name] = clearing ? "" : value;
  }
  return held;
}

describe("the cookie itself", () => {
  it("carries the __Host- prefix, as the admin cookie does", async () => {
    const { CREATOR_SESSION_COOKIE } = await import("@/lib/creator-access");
    expect(CREATOR_SESSION_COOKIE).toBe(HOST);
  });

  /**
   * The prefix is only a promise if the attributes keep it. A browser drops a
   * __Host- cookie that is not Secure, so a NODE_ENV-gated Secure would sign
   * nobody in anywhere NODE_ENV is not production.
   */
  it.each(["production", "development", "test"])(
    "meets the prefix's rules under NODE_ENV=%s",
    async (env) => {
      vi.stubEnv("NODE_ENV", env);
      const { sessionCookieOptions } = await import("@/lib/creator-session");
      const options = sessionCookieOptions() as Record<string, unknown>;
      expect(options.secure).toBe(true);
      expect(options.path).toBe("/");
      expect(options).not.toHaveProperty("domain");
    },
  );
});

describe("who currentCreator says is signed in", () => {
  const ask = async () => {
    const { currentCreator } = await import("@/lib/creator-session");
    return currentCreator();
  };

  /** The attack in one header: only the name a sibling host can plant. */
  it("does not treat the unprefixed name as a session on its own", async () => {
    cookieHeader = `${LEGACY}=${PLANTED}`;
    expect(await ask()).toBeNull();
    expect(looked, "a plantable cookie never reaches the lookup").toEqual([]);
  });

  it("honours the __Host- cookie", async () => {
    cookieHeader = `${HOST}=${MINE}`;
    expect(await ask()).toEqual(ROW);
    expect(looked).toEqual([MINE]);
  });

  /**
   * The victim holds their own session and a sibling host adds its own under
   * the old name, sorted either side. The __Host- cookie cannot have been
   * planted, so it decides, and refusing here instead would hand a sibling
   * host a way to sign a creator out that sign-out itself cannot undo.
   */
  it.each([
    `${HOST}=${MINE}; ${LEGACY}=${PLANTED}`,
    `${LEGACY}=${PLANTED}; ${HOST}=${MINE}`,
  ])("lets the __Host- cookie decide beside a planted one: %s", async (header) => {
    cookieHeader = header;
    expect(await ask()).toEqual(ROW);
    expect(looked).toEqual([MINE]);
  });

  /**
   * Next keeps whichever of two same-named cookies comes last, and the order is
   * set by Path length and age, both chosen by whoever set the cookie. Two
   * different values mean one was not ours and nothing says which.
   */
  it.each([
    `${HOST}=${MINE}; ${HOST}=${PLANTED}`,
    `${LEGACY}=${MINE}; ${LEGACY}=${PLANTED}`,
  ])("uses neither of two different values under one name: %s", async (header) => {
    cookieHeader = header;
    expect(await ask()).toBeNull();
    expect(looked).toEqual([]);
  });

  it("accepts the same value twice as the one credential it is", async () => {
    cookieHeader = `${HOST}=${MINE}; ${HOST}=${MINE}`;
    expect(await ask()).toEqual(ROW);
  });
});

describe("a creator signed in before the rename", () => {
  /**
   * Their browser holds only the old name, which cannot be told from a planted
   * one. It becomes the confirm page's question, the same as a link would, and
   * never a session nobody was asked about.
   */
  it("is asked about the old cookie, and a link's claim comes first", async () => {
    const { entryClaim } = await import("@/lib/creator-session");
    expect(entryClaim(`${LEGACY}=${MINE}`)).toEqual({ token: MINE, resuming: true });
    expect(entryClaim(`${LEGACY}=${MINE}; ${PENDING}=${PLANTED}`)).toEqual({
      token: PLANTED,
      resuming: false,
    });
  });

  it("is not asked when a __Host- session is already held, or two old values disagree", async () => {
    const { entryClaim } = await import("@/lib/creator-session");
    expect(entryClaim(`${HOST}=${MINE}; ${LEGACY}=${PLANTED}`)).toBeNull();
    expect(entryClaim(`${LEGACY}=${MINE}; ${LEGACY}=${PLANTED}`)).toBeNull();
    expect(entryClaim(`${PENDING}=${MINE}; ${PENDING}=${PLANTED}`)).toBeNull();
  });

  /**
   * The tap that carries every existing creator over, so it has to work: the
   * __Host- cookie is set with the attributes the browser demands, and the old
   * one is cleared where it lives.
   */
  it("is moved to the __Host- cookie by confirming, and the old one cleared", async () => {
    cookieHeader = `${LEGACY}=${MINE}`;
    const { enterAsPending } = await import(
      "@/app/campaigns/monica-money-story/enter/confirm/actions"
    );
    const form = new FormData();
    form.set("enrolment", "e-mine");

    await expect(enterAsPending(form)).rejects.toThrow(
      "REDIRECT /campaigns/monica-money-story/me",
    );
    expect(browserSees()[HOST]).toBe(MINE);
    expect(browserSees()[LEGACY]).toBe("");
  });

  /**
   * Where every existing creator meets the change. Told "we do not know who
   * you are" here, they would go hunting for a link that works perfectly well.
   */
  it("is sent from /me to be asked, not told we do not know them", async () => {
    cookieHeader = `${LEGACY}=${MINE}`;
    const { default: CreatorPage } = await import(
      "@/app/campaigns/monica-money-story/me/page"
    );
    await expect(CreatorPage()).rejects.toThrow(
      "REDIRECT /campaigns/monica-money-story/enter/confirm?s=go",
    );
  });

  it("is signed out of both names by signing out", async () => {
    cookieHeader = `${HOST}=${MINE}; ${LEGACY}=${MINE}`;
    const { signOut } = await import(
      "@/app/campaigns/monica-money-story/enter/confirm/actions"
    );

    await expect(signOut()).rejects.toThrow("REDIRECT");
    expect(browserSees()[HOST], "a clear without Secure is refused").toBe("");
    expect(browserSees()[LEGACY]).toBe("");
  });
});
