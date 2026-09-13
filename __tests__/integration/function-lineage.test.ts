/**
 * A redefinition must not silently drop a rule an earlier one added.
 *
 * CREATE OR REPLACE FUNCTION replaces the entire body and reports nothing about
 * what was in the old one. Five functions here have been redefined between two
 * and five times, each time by copying the previous body and changing one
 * thing, which means every redefinition is one careless copy away from
 * reverting a fix nobody remembers.
 *
 * That is not hypothetical. Writing 0024 I took award_points from 0016, where
 * it was introduced, rather than from 0020, where it was last defined, and
 * reverted the would_go_negative check that stops an admin taking a creator's
 * points below zero. The manual award suite caught it by luck: it happened to
 * assert that exact message. A rule with no test asserting its exact text would
 * have gone out silently.
 *
 * This asserts the invariant directly, on the SQL, so it does not depend on
 * some other suite happening to cover the rule that gets dropped.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS_DIR, migrationFiles } from "../helpers/migrations";

/** Every function definition in a file, as name to body. */
function definitions(sql: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /CREATE OR REPLACE FUNCTION (\w+)\s*\(/g;

  for (const match of sql.matchAll(pattern)) {
    const name = match[1];
    const from = match.index ?? 0;
    // To the closing $$; of this definition.
    const languageAt = sql.indexOf("LANGUAGE", from);
    const bodyAt = sql.indexOf("$$", languageAt);
    const end = sql.indexOf("$$;", bodyAt);
    if (end === -1) continue;
    found.set(name, sql.slice(from, end + 3));
  }

  return found;
}

/** The names a body raises, which are the rules it enforces. */
const raisesIn = (body: string): Set<string> =>
  new Set(
    [...body.matchAll(/RAISE EXCEPTION\s+'([a-z_]+)/g)].map((m) => m[1]),
  );

/**
 * Rules a later migration removed on purpose, with the reason.
 *
 * Deliberately a list that has to be edited, so dropping a rule is a decision
 * somebody writes down rather than a diff nobody reads.
 */
const DELIBERATELY_DROPPED: Record<string, string[]> = {
  /*
   * 0034: the campaign team ruled the handle verification step out. Asking
   * every creator to publish a BF- code on each account before their work can
   * score was a hurdle at the moment the campaign wants people posting. What
   * the rule bought is recorded in 0034's header: proof that the registered
   * handle belongs to the registrant, which no automatic check provides. The
   * reviewer seeing the registered handle beside every link is the defence
   * that remains, and restoring the RAISE is one migration if week one proves
   * the team wrong.
   */
  review: ["handle_not_verified"],
};

describe("every redefined function", () => {
  it("keeps every rule its previous definition enforced", () => {
    const latest = new Map<string, { file: string; raises: Set<string> }>();
    const regressions: string[] = [];

    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

      for (const [name, body] of definitions(sql)) {
        const previous = latest.get(name);
        const raises = raisesIn(body);

        if (previous) {
          const allowed = DELIBERATELY_DROPPED[name] ?? [];
          const lost = [...previous.raises].filter(
            (rule) => !raises.has(rule) && !allowed.includes(rule),
          );

          for (const rule of lost) {
            regressions.push(
              `${file} redefines ${name}() and drops '${rule}', which ${previous.file} raised. ` +
                `If that is deliberate, add it to DELIBERATELY_DROPPED with the reason.`,
            );
          }
        }

        latest.set(name, { file, raises });
      }
    }

    expect(regressions, regressions.join("\n")).toEqual([]);
  });

  it("can tell a dropped rule from a kept one", () => {
    // The guard must not pass by finding nothing to compare.
    const before = definitions(
      `CREATE OR REPLACE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'kept'; RAISE EXCEPTION 'lost'; END $$;`,
    );
    const after = definitions(
      `CREATE OR REPLACE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'kept'; END $$;`,
    );

    const wasRaising = raisesIn(before.get("f")!);
    const nowRaising = raisesIn(after.get("f")!);

    expect(wasRaising.has("lost")).toBe(true);
    expect([...wasRaising].filter((r) => !nowRaising.has(r))).toEqual(["lost"]);
  });

  it("actually found the functions, so it is not passing on an empty set", () => {
    const seen = new Set<string>();
    for (const file of migrationFiles()) {
      for (const name of definitions(
        readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
      ).keys()) {
        seen.add(name);
      }
    }

    for (const required of ["submit_entry", "award_points", "review"]) {
      expect(seen, `${required} should be among the tracked functions`).toContain(
        required,
      );
    }
  });
});

/**
 * Migration numbering, which a deploy enforces and nothing else did.
 *
 * Netlify applies migrations in lexicographic order and rejects any whose
 * numeric prefix is not above the highest already applied. A rejected migration
 * does not get skipped: it fails the deploy. Two files sharing a prefix is
 * therefore safe only while neither has been applied, and stops being safe the
 * moment one of them ships.
 *
 * That is not hypothetical here. 0029_admin_sessions.sql and a second 0029
 * existed on separate branches at the same time, and the collision was invisible
 * until both were merged.
 */
describe("migration filenames", () => {
  it("never reuses a numeric prefix", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];

    for (const file of migrationFiles()) {
      const prefix = file.split("_")[0];
      const previous = seen.get(prefix);
      if (previous) clashes.push(`${prefix}: ${previous} and ${file}`);
      else seen.set(prefix, file);
    }

    expect(
      clashes,
      `two migrations share a prefix, which blocks the deploy once either is applied:\n${clashes.join("\n")}`,
    ).toEqual([]);
  });

  it("numbers them in strictly ascending order", () => {
    const prefixes = migrationFiles().map((f) => f.split("_")[0]);
    expect([...prefixes].sort()).toEqual(prefixes);
  });
});
