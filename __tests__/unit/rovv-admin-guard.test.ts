// @vitest-environment node
/**
 * The guards on Rovv's console routes, answered before anything is touched.
 *
 * Reviewers rule on entries; owners pick, export and email. A cross-site
 * request is refused before the session is even resolved, and a reviewer at
 * an owner route is refused before the database or the mailer is reached.
 * The database and mailer here throw if called, so "refused" cannot pass by
 * doing the work and then answering 403.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner" as "owner" | "reviewer",
  resolved: 0,
  touched: [] as string[],
}));

vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: () => {
    state.touched.push("db");
    throw new Error("the database was reached");
  },
}));
vi.mock("@/lib/admin/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/session")>();
  return {
    ...real,
    requireAdmin: async () => {
      state.resolved += 1;
      return {
        ok: true,
        admin: { adminId: "00000000-0000-4000-8000-000000000001", role: state.role, email: "a@example.test" },
      };
    },
  };
});
vi.mock("@/lib/throttle", () => ({
  allowKeyStrict: async () => {
    state.touched.push("throttle");
    return true;
  },
}));
vi.mock("@/lib/email/client", () => ({
  sendEmail: async () => {
    state.touched.push("mail");
    return { sent: true };
  },
  sendEmailQuietly: async () => {
    state.touched.push("mail");
  },
}));
vi.mock("@/lib/email/copy", () => ({
  sendBulkCopy: async () => {
    state.touched.push("copy");
  },
}));

const decision = await import("@/app/api/admin/rovv/decision/route");
const winner = await import("@/app/api/admin/rovv/winner/route");
const notify = await import("@/app/api/admin/rovv/notify/route");
const exporter = await import("@/app/api/admin/rovv/export/route");
const coder = await import("@/app/api/admin/rovv/code/route");
const testClear = await import("@/app/api/admin/rovv/test-clear/route");
const testNotify = await import("@/app/api/admin/rovv/test-notify/route");
const codesRoute = await import("@/app/api/admin/rovv/codes/route");

const SITE = "https://blockfestafrica.com";
const ENTRY = "00000000-0000-4000-8000-0000000000aa";

function post(path: string, body: unknown, origin: string | null = SITE) {
  return new NextRequest(`${SITE}${path}`, {
    method: "POST",
    headers: {
      "x-forwarded-host": "blockfestafrica.com",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.role = "owner";
  state.resolved = 0;
  state.touched = [];
});

describe("a request from another site", () => {
  it.each([
    ["decision", () => decision.POST(post("/api/admin/rovv/decision", { entryId: ENTRY, status: "eligible", revision: 1 }, "https://evil.example"))],
    ["winner", () => winner.POST(post("/api/admin/rovv/winner", { entryId: ENTRY, pick: true }, "https://evil.example"))],
    ["notify", () => notify.POST(post("/api/admin/rovv/notify", {}, "https://evil.example"))],
    ["decision, no origin", () => decision.POST(post("/api/admin/rovv/decision", { entryId: ENTRY, status: "eligible", revision: 1 }, null))],
    ["winner, no origin", () => winner.POST(post("/api/admin/rovv/winner", { entryId: ENTRY, pick: true }, null))],
    ["code", () => coder.POST(post("/api/admin/rovv/code", { entryId: ENTRY, code: "X-1" }, "https://evil.example"))],
    ["test-clear", () => testClear.POST(post("/api/admin/rovv/test-clear", {}, "https://evil.example"))],
    ["test-notify", () => testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: ENTRY }, "https://evil.example"))],
    ["test-clear, no origin", () => testClear.POST(post("/api/admin/rovv/test-clear", {}, null))],
    ["codes", () => codesRoute.POST(post("/api/admin/rovv/codes", { text: "A-1" }, "https://evil.example"))],
  ])("is refused at %s before the session is read", async (_name, call) => {
    const answer = await call();
    expect(answer.status).toBe(403);
    expect(state.resolved).toBe(0);
    expect(state.touched).toEqual([]);
  });

  it("is refused at the export when the browser says cross-site", async () => {
    const answer = await exporter.GET(
      new NextRequest(`${SITE}/api/admin/rovv/export?of=all`, {
        headers: { "sec-fetch-site": "cross-site", "x-forwarded-host": "blockfestafrica.com" },
      }),
    );
    expect(answer.status).toBe(403);
    expect(state.resolved).toBe(0);
    expect(state.touched).toEqual([]);
  });
});

describe("a reviewer at an owner route", () => {
  beforeEach(() => {
    state.role = "reviewer";
  });

  it("cannot pick or unpick a winner", async () => {
    for (const pick of [true, false]) {
      const answer = await winner.POST(post("/api/admin/rovv/winner", { entryId: ENTRY, pick }));
      expect(answer.status).toBe(403);
    }
    expect(state.touched).toEqual([]);
  });

  it.each([
    ["set a ticket code", () => coder.POST(post("/api/admin/rovv/code", { entryId: ENTRY, code: "X-1" }))],
    ["delete the test entries", () => testClear.POST(post("/api/admin/rovv/test-clear", {}))],
    ["send a test winner email", () => testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: ENTRY }))],
    ["hand out pasted codes", () => codesRoute.POST(post("/api/admin/rovv/codes", { text: "A-1" }))],
  ])("cannot %s, and nothing is read or sent", async (_name, call) => {
    const answer = await call();
    expect(answer.status).toBe(403);
    expect(state.touched).toEqual([]);
  });

  it("cannot email the winners, and nothing is throttled, read or sent", async () => {
    const answer = await notify.POST(post("/api/admin/rovv/notify", {}));
    expect(answer.status).toBe(403);
    expect(state.touched).toEqual([]);
  });

  it.each(["all", "winners"])("cannot download ?of=%s", async (of) => {
    const answer = await exporter.GET(
      new NextRequest(`${SITE}/api/admin/rovv/export?of=${of}`, {
        headers: { "x-forwarded-host": "blockfestafrica.com" },
      }),
    );
    expect(answer.status).toBe(403);
    expect(((await answer.json()) as { message: string }).message).toMatch(/as an owner/);
    expect(state.touched).toEqual([]);
  });

  it("can still reach the decision route, which is reviewer work", async () => {
    // The mocked database throws, so getting as far as it is the proof the
    // role did not stop a reviewer; the route answers its own 500.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const answer = await decision.POST(post("/api/admin/rovv/decision", { entryId: ENTRY, status: "eligible", revision: 1 }));
    expect(answer.status).toBe(500);
    expect(state.touched).toEqual(["db"]);
  });

  it("is told a ruling-out needs a reason before the database is asked", async () => {
    const answer = await decision.POST(post("/api/admin/rovv/decision", { entryId: ENTRY, status: "ineligible", note: "  ", revision: 1 }));
    expect(answer.status).toBe(400);
    expect(state.touched).toEqual([]);
  });
});
