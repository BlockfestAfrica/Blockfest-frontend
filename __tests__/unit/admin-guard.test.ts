/**
 * The guard around the call that mints prize money.
 *
 * Approving a submission awards points, and points decide how 5,000,000 naira
 * is split. The security review took apart the usual way of protecting that: a
 * middleware matcher, or a check in a layout, or a convention about which
 * folder handlers live in. All of those key on a path, and all of them are
 * bypassed by a Server Action posting to a page, or by a handler saved
 * somewhere the matcher does not name. Both look entirely ordinary in review.
 *
 * So the guard is a type. reviewSubmission takes an AdminIdentity, nothing
 * outside requireAdmin can construct one, and an unguarded call site therefore
 * does not compile.
 *
 * A type only protects callers that go through the module, so these assertions
 * cover the other half: that no other file reaches the database function
 * directly, and that nothing under the admin surface introduces a Server Action
 * the type cannot see.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Files under these paths whose contents match, walked in Node.
 *
 * Deliberately not shelling out to grep. The first version of this built a
 * command by interpolating the pattern into a single-quoted shell string, and
 * one of the patterns contained single quotes: `'use server'` collapsed the
 * quoting and turned the command into a search for "use" in a file named
 * "server". It matched every file containing the word "use" and the assertion
 * failed for a reason that had nothing to do with the code under test.
 *
 * That is the same mistake as building SQL by concatenation, in a test whose
 * whole job is to catch that class of mistake. There is no shell here now.
 *
 * Missing paths are skipped rather than failing: the admin pages are built
 * after the guard that protects them, and a guard test that only works once the
 * thing it guards exists is one nobody runs first.
 */
function filesUnder(paths: string[]): string[] {
  const found: string[] = [];

  const walk = (rel: string) => {
    const abs = join(process.cwd(), rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(next);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        found.push(next);
      }
    }
  };

  paths.forEach(walk);
  return found;
}

function grep(pattern: RegExp, paths: string[]): string[] {
  return filesUnder(paths).filter((f) =>
    pattern.test(readFileSync(join(process.cwd(), f), "utf8")),
  );
}

/** Lines of code, with comments and blank lines removed. */
function codeLines(file: string): string[] {
  return readFileSync(join(process.cwd(), file), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("//") &&
        !l.startsWith("*") &&
        !l.startsWith("/*"),
    );
}

describe("the review() call site", () => {
  it("exists in exactly one file", () => {
    // A second one would be a call the type never sees.
    const hits = grep(/review\(/, ["lib", "app", "components"]).filter((f) =>
      /sql`|sql\(/.test(readFileSync(join(process.cwd(), f), "utf8")),
    );

    const offenders = hits.filter(
      (f) =>
        !f.endsWith("lib/admin/review.ts") &&
        // The migrations define it; they are not callers.
        !f.startsWith("netlify/"),
    );

    expect(
      offenders,
      `review() is reachable from files other than lib/admin/review.ts:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("demands an admin argument rather than defaulting one", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/admin/review.ts"),
      "utf8",
    );
    // Four arguments, the third being the actor. review() raises
    // reviewer_required on a null actor, so a three-argument call would be a
    // runtime failure rather than a compile error.
    expect(src).toMatch(/admin\.adminId/);
    expect(src).toMatch(/review\(\$\{submissionId\}/);
  });
});

describe("the admin surface", () => {
  it("has no Server Actions, which no guard here can see", () => {
    // A "use server" function posts to the page URL and is wrapped by nothing:
    // not the route handler, not the type, not any matcher.
    const offenders = grep(
      /["']use server["']/,
      ["app/admin", "app/api/admin"],
    );
    expect(
      offenders,
      `Server Actions under the admin surface bypass every guard:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("never reads the spoofable client address", () => {
    // x-forwarded-for is attacker controlled. Keying a throttle on it lets an
    // attacker evade their own budget and spend a named reviewer's, which
    // during a live review window is a way to lock somebody out of the queue.
    // Mentions in a comment are fine, and there is one: the comment explaining
    // why this header is never read. What must not exist is a line of code that
    // reads it.
    const offenders = grep(/x-forwarded-for/, ["lib/admin", "app/api/admin"])
      .flatMap((file) =>
        codeLines(file)
          .filter((l) => l.includes("x-forwarded-for"))
          .map((l) => `${file}: ${l}`),
      );

    expect(
      offenders,
      `admin code must key on x-nf-client-connection-ip only:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * Every admin page is behind a guard, and there are only two ways to be.
   *
   * The console pages used to call requireAdmin each, with the signed-out block
   * written out once per page. That moved into app/admin/(console)/layout.tsx,
   * which resolves the admin and returns the signed-out block without rendering
   * children, so pages inside that group are guarded by construction.
   *
   * Which creates a new way to get this wrong that did not exist before: a page
   * added under app/admin but OUTSIDE the route group is not wrapped by that
   * layout at all, and would render admin data to anybody. It looks right in
   * the file tree, and nothing else in this suite would notice.
   *
   * /admin/login is the one page that is deliberately outside and deliberately
   * open: it is how somebody who is not yet an admin signs in, and it shows
   * nothing.
   */
  it("guards every admin page, by layout or by its own call", () => {
    const OPEN_BY_DESIGN = ["app/admin/login/page.tsx"];

    const pages = filesUnder(["app/admin"]).filter((f) =>
      /\/page\.tsx$/.test(f),
    );
    expect(pages.length, "found the admin pages").toBeGreaterThan(3);

    const unguarded = pages.filter((file) => {
      if (OPEN_BY_DESIGN.includes(file)) return false;
      // Inside the console group, so the layout has already refused everybody
      // who is not an admin before this page renders.
      if (file.includes("/(console)/")) return false;
      return !readFileSync(join(process.cwd(), file), "utf8").includes(
        "requireAdmin(",
      );
    });

    expect(
      unguarded,
      `these admin pages sit outside app/admin/(console) and never call requireAdmin, so they render to anybody:\n${unguarded.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the console layout itself guarded", () => {
    // The single point everything above depends on. If this stops calling
    // requireAdmin, every page in the group silently opens at once.
    const src = readFileSync(
      join(process.cwd(), "app/admin/(console)/layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/await requireAdmin\(\)/);
    expect(src, "and refuses before rendering children").toMatch(
      /if \(!admin\.ok\)/,
    );
  });

  it("checks the origin on every state-changing admin route", () => {
    const routes = grep(/export async function (POST|PUT|PATCH|DELETE)/, ["app/api/admin"]);
    expect(routes.length).toBeGreaterThan(0);

    for (const file of routes) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(
        src.includes("sameOrigin("),
        `${file} changes state without an origin check, so any site can make a signed-in admin do it`,
      ).toBe(true);
    }
  });

  it("resolves the admin from the database, never from the token's roles", () => {
    const src = readFileSync(join(process.cwd(), "lib/admin/session.ts"), "utf8");
    // Roles in the nf_jwt are stale for about an hour after a revocation, so a
    // stolen laptop would keep working. The row is the authority.
    expect(src).toContain("resolve_admin");
    expect(src).not.toMatch(/roles\.includes\(/);
  });
});

describe("failing closed", () => {
  it("denies when identity cannot be resolved at all", () => {
    const src = readFileSync(join(process.cwd(), "lib/admin/identity.ts"), "utf8");
    // An unknown runtime must not be read as permission.
    expect(src).toMatch(/reason: "unavailable"/);
    expect(src).toMatch(/catch/);
  });

  it("denies when the database cannot answer", () => {
    const src = readFileSync(join(process.cwd(), "lib/admin/session.ts"), "utf8");
    expect(src).toMatch(/catch/);
    expect(src).toMatch(/return DENIED/);
  });

  it("gives one answer to everybody who is not an admin", () => {
    const src = readFileSync(join(process.cwd(), "lib/admin/session.ts"), "utf8");
    // Distinguishing unknown from revoked from mismatched would let somebody
    // enumerate the admin list by trying addresses.
    expect(src).toContain("const DENIED");
    expect(src).not.toMatch(/reason:\s*"revoked"/);
  });
});
