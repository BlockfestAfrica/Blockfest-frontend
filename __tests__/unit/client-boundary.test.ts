/**
 * Server components must not call values out of "use client" modules.
 *
 * This shipped a 500 to every signed-in creator. The page imported
 * formatTimeLeft from components/campaigns/time-left-label.tsx, which carries
 * "use client", and called it during a server render. Next replaces the exports
 * of a client module with client references when a server component imports
 * them, so calling one is not calling a function.
 *
 * Every check we have said it was fine. TypeScript sees an ordinary exported
 * function and a matching signature. next build compiles it. The whole suite
 * passed, because nothing here renders that page. And the call sat inside the
 * branch that only runs when a challenge is open, so the route returned 200 to
 * anybody without a session and 500 to every creator who had one.
 *
 * Components are exempt: passing a client component into server-rendered JSX is
 * the entire point of the boundary. What must not happen is a plain function or
 * constant being pulled across it and invoked.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ROOTS = ["app", "components", "lib"];

function filesUnder(dirs: string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    const abs = join(ROOT, dir);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) found.push(next);
    }
  };
  dirs.forEach(walk);
  return found;
}

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** A module that begins with the client directive. */
function isClientModule(file: string): boolean {
  return /^\s*["']use client["']/.test(read(file));
}

/** Resolve an @/ import to a real file, trying both extensions. */
function resolveImport(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = spec.slice(2);
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = `${base}${ext}`;
    try {
      readFileSync(join(ROOT, candidate), "utf8");
      return candidate;
    } catch {
      /* try the next extension */
    }
  }
  return null;
}

/** PascalCase reads as a component, which may legitimately cross the boundary. */
const isComponentName = (name: string) => /^[A-Z]/.test(name);

describe("the client boundary", () => {
  it("is never crossed by a value a server module then calls", () => {
    const offenders: string[] = [];

    for (const file of filesUnder(ROOTS)) {
      if (isClientModule(file)) continue;

      const src = read(file);
      for (const match of src.matchAll(
        /import\s*\{([^}]+)\}\s*from\s*["'](@\/[^"']+)["']/g,
      )) {
        const target = resolveImport(match[2]);
        if (!target || !isClientModule(target)) continue;

        const names = match[1]
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
          .filter(Boolean)
          .filter((n) => !n.startsWith("type "));

        for (const name of names) {
          if (isComponentName(name)) continue;
          offenders.push(
            `${relative(".", file)} imports \`${name}\` from ${match[2]} ("use client")`,
          );
        }
      }
    }

    expect(
      offenders,
      `a server module is pulling a non-component value out of a client module. Next turns those exports into client references, so calling one throws at request time while TypeScript, the build and every test stay green:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("recognises the modules it is meant to be checking", () => {
    // Guards against the whole test quietly passing because resolveImport
    // stopped resolving anything, or nothing is marked "use client" any more.
    const all = filesUnder(ROOTS);
    expect(all.filter(isClientModule).length).toBeGreaterThan(5);
    expect(resolveImport("@/lib/countdown")).toBe("lib/countdown.ts");
    expect(
      isClientModule("components/campaigns/time-left-label.tsx"),
      "the module this bug came from is still a client module",
    ).toBe(true);
  });
});
