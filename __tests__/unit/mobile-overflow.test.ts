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
  /*
   * The exemption above is only sound while this is true, so it is asserted
   * rather than assumed.
   */
  it("keeps the height inside the shared button helper", () => {
    const panel = readFileSync(
      join(process.cwd(), "components/shared/panel.tsx"),
      "utf8",
    );
    const body = panel.slice(panel.indexOf("export function buttonClass"));
    expect(
      /\bmin-h-(1[2-9]|[2-9][0-9])\b/.test(body.slice(0, 600)),
      "buttonClass must set its own min-height, or every call site loses its tap target",
    ).toBe(true);
  });

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

  /**
   * min-w-0 is not enough on its own, which this suite learned the hard way.
   *
   * These rows are `flex flex-col gap-2 sm:flex-row`, so below the small
   * breakpoint the main axis is vertical. min-w-0 constrains the MAIN axis, so
   * once the row stacks it stops constraining the width at all, and a nowrap
   * URL contributes its full length as the container's cross size. The card
   * then grows wider than the viewport and html/body clip it, which cuts every
   * paragraph on the page mid-word rather than just shortening the URL.
   *
   * w-full caps the element at the container width in both directions.
   */
  it("cannot widen a column that has stacked", () => {
    const offenders: string[] = [];

    for (const file of ALL) {
      for (const cls of classNames(file)) {
        const isFlexChild = /\bflex-1\b/.test(cls);
        const cannotWrap = /\btruncate\b/.test(cls);
        const cappedToParent = /\bw-full\b|\bmax-w-full\b/.test(cls);
        if (isFlexChild && cannotWrap && !cappedToParent) {
          offenders.push(`${file}: ${cls}`);
        }
      }
    }

    expect(
      offenders,
      `a truncating flex child needs w-full as well as min-w-0, or it widens the card once the row stacks:\n${offenders.join("\n")}`,
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

      /*
       * The whole opening tag, not the first className after it.
       *
       * The first version matched `className="..."` within 600 characters of
       * `<button`, which silently skipped every button whose class is a
       * template literal, `className={...}`, and matched a nested span instead.
       * It then reported the span's classes as an undersized button. Two real
       * buttons were flagged for a class belonging to an arrow glyph.
       */
      for (const match of src.matchAll(/<button\b/g)) {
        // Everything from `<button` to the next element start. Attributes
        // cannot contain `<`, and arrow functions in handlers contain `=>`
        // rather than a bare `>`, so stopping at `>` truncated the tag before
        // the class ever appeared. This takes the attributes and no children.
        const from = match.index ?? 0;
        const nextChild = src.indexOf("<", from + 1);
        const tag = src.slice(from, nextChild === -1 ? from + 1200 : nextChild);
        const hasMin = /\bmin-h-(1[1-9]|[2-9][0-9])\b/.test(tag);
        const hasPadding = /\bpy-[3-9]\b/.test(tag);
        /*
         * buttonClass() carries the height itself, and the assertion below
         * proves it does. Without this the guard reads the call site, sees no
         * min-h in the literal text, and reports a button that is in fact 48px
         * tall. A guard that cannot see through the helper pushes people back
         * to hand-rolled class strings, which is what the helper exists to
         * stop.
         */
        const viaHelper = /\bbuttonClass\(/.test(tag);
        if (!hasMin && !hasPadding && !viaHelper) {
          offenders.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 90)}`);
        }
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
    /*
     * The author segment is what the decision turns on, and a long handle
     * can push it past a truncation.
     *
     * Asserted over BOTH render paths rather than by slicing backwards from
     * the first "{item.url}". The URL now renders as a link when its host
     * can be proved to be a platform and as plain text when it cannot, so
     * there are two elements to defend; and the old slice began at
     * href={item.url}, which is not the one that displays the text.
     */
    const src = readFileSync(join(process.cwd(), QUEUE), "utf8");
    const branch = src.slice(
      src.indexOf("openableHref(item.url) ?"),
      src.indexOf("</code>"),
    );
    expect(branch, "found the render branch").not.toBe("");

    const classNames = [...branch.matchAll(/className="([^"]+)"/g)]
      .map((m) => m[1])
      // The screen-reader "(opens in a new tab)" span carries no layout and
      // is not the element displaying the URL.
      .filter((cls) => cls !== "sr-only");
    expect(classNames.length, "both the link and the text fallback").toBeGreaterThanOrEqual(2);
    for (const cls of classNames) {
      expect(cls, cls).toContain("break-all");
      expect(cls, cls).not.toContain("truncate");
    }
  });

  it("renders a different message for a checked and an unchecked link", () => {
    // Asserted as a branch, not as wording. A test that matched the copy would
    // break every time the copy improved, and would still pass if both
    // branches were changed to say the same thing, which is the actual risk:
    // an unchecked link that reads as verified.
    const src = readFileSync(join(process.cwd(), QUEUE), "utf8");
    expect(src).toContain("item.autoChecked");
    expect(src).toMatch(/item\.autoChecked\s*\?/);

    // Two arms, visually distinguished, or the distinction is invisible.
    const branch = src.slice(src.indexOf("item.autoChecked ?"));
    expect(branch).toMatch(/text-(green|emerald)-/);
    expect(branch).toMatch(/text-(amber|red|yellow)-/);
  });
});

describe("two-column grids", () => {
  /**
   * Default deny, with a written exception.
   *
   * The rule exists because a two-column grid at 360px gives two unusable
   * columns, and that is about the width the content needs, not about grids.
   * A row of three figures whose labels are one word and whose values are
   * numbers fits a 104px column comfortably, and forcing it to stack costs
   * roughly 300px of vertical space on the one screen creators open weekly.
   *
   * So an unprefixed grid is still a failure unless the line above it carries
   * a marker saying why, which keeps the exception visible in review and stops
   * this from quietly becoming "grids are fine now".
   */
  const OPT_OUT = /mobile-grid-ok:\s*[a-z]/i;

  it("are single column before the small breakpoint, unless justified", () => {
    const offenders: string[] = [];

    for (const file of ALL) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of src.matchAll(/className="([^"]+)"/g)) {
        const cls = match[1];
        if (!/(^|\s)grid-cols-[2-9]/.test(cls)) continue;

        // The 200 characters before the attribute: enough to reach a comment
        // on the line above without reaching the previous element.
        const before = src.slice(Math.max(0, match.index - 200), match.index);
        if (OPT_OUT.test(before)) continue;

        offenders.push(`${file}: ${cls}`);
      }
    }

    expect(
      offenders,
      `grid columns must be behind a breakpoint, for example sm:grid-cols-2.\nIf a row genuinely fits at 360px, put a comment above it saying so:\n  {/* mobile-grid-ok: three one-word labels over numbers */}\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("does not let an unexplained grid through", () => {
    // The opt-out has to be a reason, not just the word.
    //
    // The first version tested for one non-space character, which the closing
    // delimiter of an empty comment satisfied, so a bare "mobile-grid-ok:"
    // with nothing after it passed. That is the shape this decays into.
    //
    // (Written as line comments on purpose: the first version of this note
    //  spelled that delimiter out inside a block comment and closed it.)
    expect(OPT_OUT.test("{/* mobile-grid-ok: */}")).toBe(false);
    expect(OPT_OUT.test("{/* mobile-grid-ok:   */}")).toBe(false);
    expect(OPT_OUT.test("{/* mobile-grid-ok: numbers only */}")).toBe(true);
  });
});
