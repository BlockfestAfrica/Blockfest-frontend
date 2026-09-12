/**
 * Overflow traps on narrow screens.
 *
 * These are worth a test rather than an eye because they are invisible. The
 * site sets overflow-x: hidden on html and body, so anything too wide is
 * clipped rather than scrollable: no sideways scrollbar appears, nothing looks
 * broken, and the end of the content is simply gone. On the review queue that
 * would silently remove the part of a URL the decision turns on.
 *
 * Two traps, both flexbox:
 *
 * A flex item does not shrink below its content unless min-width is set. So
 * `flex-1 truncate` on a long string keeps its full width and pushes whatever
 * is beside it, usually a button, off the screen. `min-w-0` is what makes
 * truncation actually happen.
 *
 * And `truncate` itself hides the end of a string. That is right for a link
 * with a copy button beside it, and wrong for one somebody has to read.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCREENS = [
  "app/campaigns/monica-money-story",
  "app/admin",
  "components/campaigns",
  "components/admin",
];

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(process.cwd(), rel), {
      withFileTypes: true,
    })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx$/.test(entry.name)) out.push(next);
    }
  };
  SCREENS.forEach((d) => walk(d));
  return out.filter((f) => f.startsWith(dir));
}

const ALL = SCREENS.flatMap((d) => filesUnder(d));

/** Every className string in a file, flattened. */
function classNames(file: string): string[] {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  return [...src.matchAll(/className="([^"]+)"/g)].map((m) => m[1]);
}

describe("flex items that hold long strings", () => {
  it("can shrink, so they do not push a button off a narrow screen", () => {
    const offenders: string[] = [];

    for (const file of ALL) {
      for (const cls of classNames(file)) {
        const isFlexChild = /\bflex-1\b/.test(cls);
        const holdsLongText = /\btruncate\b|\bbreak-all\b/.test(cls);
        const canShrink = /\bmin-w-0\b/.test(cls);
        if (isFlexChild && holdsLongText && !canShrink) {
          offenders.push(`${file}: ${cls}`);
        }
      }
    }

    expect(
      offenders,
      `flex-1 with a long string needs min-w-0 or it will not shrink:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("touch targets", () => {
  it("are at least 44px on every button in this flow", () => {
    // Below about 44px a control is hard to hit on a phone, which on the review
    // queue means mis-tapping approve instead of reject.
    const offenders: string[] = [];

    for (const file of ALL) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of src.matchAll(/<button[\s\S]{0,600}?className="([^"]+)"/g)) {
        const cls = match[1];
        const hasMin = /\bmin-h-(1[1-9]|[2-9][0-9])\b/.test(cls);
        const hasPadding = /\bpy-[3-9]\b/.test(cls);
        if (!hasMin && !hasPadding) offenders.push(`${file}: ${cls.slice(0, 80)}`);
      }
    }

    expect(
      offenders,
      `buttons need min-h-11 or more, or vertical padding:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("the review queue specifically", () => {
  const QUEUE = "components/admin/review-queue.tsx";

  it("shows the whole submitted URL rather than truncating it", () => {
    // The author segment is what the decision turns on, and a long handle can
    // push it past a truncation.
    const src = readFileSync(join(process.cwd(), QUEUE), "utf8");
    const urlBlock = src.slice(src.indexOf("{item.url}") - 400, src.indexOf("{item.url}"));
    expect(urlBlock).toContain("break-all");
    expect(urlBlock).not.toContain("truncate");
  });

  it("says when the link could not be checked automatically", () => {
    const src = readFileSync(join(process.cwd(), QUEUE), "utf8");
    expect(src).toContain("autoChecked");
    expect(src).toMatch(/checked automatically/i);
  });
});

describe("two-column grids", () => {
  it("are single column before the small breakpoint", () => {
    // A two-column grid at 360px gives two unusable columns.
    const offenders: string[] = [];

    for (const file of ALL) {
      for (const cls of classNames(file)) {
        if (/(^|\s)grid-cols-[2-9]/.test(cls)) {
          offenders.push(`${file}: ${cls}`);
        }
      }
    }

    expect(
      offenders,
      `grid columns must be behind a breakpoint, for example sm:grid-cols-2:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
