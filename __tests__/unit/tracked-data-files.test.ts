/**
 * No spreadsheet export is tracked.
 *
 * .gitignore lists *.csv, but an ignore rule only stops a file being added. It
 * does nothing for a file already in the index, or for one a merge carries in
 * from a branch that still had it, which is how the insights export came back
 * with #244 after 7c11a12 had removed it. So the build refuses it instead: a
 * tracked spreadsheet fails this suite, and this suite gates every deploy.
 *
 * Real data belongs in data/secure/, which is ignored. A synthetic fixture that
 * genuinely has to live in the repository goes in ALLOWED, by path, in review.
 */

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = process.env.PWD ?? process.cwd();

/** Synthetic fixtures reviewed into the repository on purpose. */
const ALLOWED = new Set<string>();

const SPREADSHEET = /\.(csv|tsv|xlsx?|ods)$/i;

/**
 * Every path in the index. No shell, and a missing git throws, which fails the
 * suite rather than letting it pass on an empty list.
 */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

describe("tracked files", () => {
  it("include no spreadsheet export", () => {
    const found = trackedFiles().filter(
      (file) => SPREADSHEET.test(file) && !ALLOWED.has(file),
    );

    expect(
      found,
      `these spreadsheets are tracked. Move real data to data/secure/ and run git rm --cached on them:\n${found.join("\n")}`,
    ).toEqual([]);
  });

  it("are read from git, so the check cannot pass by listing nothing", () => {
    expect(trackedFiles()).toContain("package.json");
  });
});
