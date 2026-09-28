import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Three places the console did something and said nothing.
 *
 * Asserted against the shipped source rather than by rendering, matching
 * how the other console UI guards in this suite are written. Each one pins
 * a specific defect, so the comment above it is the failure it prevents.
 */

/*
 * Comments stripped before matching.
 *
 * This codebase explains its decisions in long comments, so a file that
 * removed `busy === item.id` still contains those words in the sentence
 * saying why. An assertion that reads prose reports the thing it is
 * checking for as still present. The same trap has now been hit in the
 * purge check and the admin roster check.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const read = (p: string) =>
  codeOnly(readFileSync(join(process.cwd(), p), "utf8"));
const QUEUE = "components/admin/review-queue.tsx";
const CONFIRM = "components/shared/confirm.tsx";

describe("a refused decision", () => {
  it("refreshes the queue instead of asking the reviewer to reload", () => {
    /*
     * The success path refreshed and the failure path returned early, so a
     * 409 left a row on screen describing a state that no longer exists,
     * with its buttons live. The server's 404 copy had to end with "reload
     * the queue to see what is left".
     */
    const src = read(QUEUE);
    const failure = src.slice(
      src.indexOf("if (!response.ok || !result.ok)"),
      src.indexOf("Named, not bare"),
    );
    expect(failure, "found the failure branch").not.toBe("");
    expect(failure).toContain("router.refresh()");
  });
});

describe("the decision buttons", () => {
  const src = read(QUEUE);

  it("both say what they are doing", () => {
    expect(src).toContain('"Approving…"');
    expect(src).toContain('"Rejecting…"');
  });

  it("only the pressed one animates", () => {
    // busy held just the row id, so both buttons read busy === item.id. A
    // naive Rejecting… would have fired while an APPROVE was in flight.
    expect(src).not.toMatch(/busy === item\.id/);
    expect(src).toMatch(/busy\.decision === "approved"/);
    expect(src).toMatch(/busy\.decision === "rejected"/);
    // And each label is gated on the row as well as the direction.
    expect(src).toMatch(/busy\?\.id === item\.id && busy\.decision/);
  });

  it("marks itself busy for a screen reader", () => {
    expect(src).toMatch(/aria-busy=/);
  });
});

describe("Confirm, which every irreversible action goes through", () => {
  const src = read(CONFIRM);

  it("shows its busy state where it can actually be seen", () => {
    /*
     * Confirming closes the dialog in the same tick it calls onConfirm, so
     * the confirm button unmounts before pending becomes true. The label
     * has to live on the collapsed trigger or it renders nowhere.
     */
    const collapsed = src.slice(src.indexOf("if (!asking)"), src.indexOf("role=\"alertdialog\""));
    expect(collapsed, "found the collapsed trigger").not.toBe("");
    expect(collapsed).toContain('pending ? "Working…" : label');
    expect(collapsed).toContain("aria-busy={pending}");
  });

  it("still refuses a second press while pending", () => {
    const collapsed = src.slice(src.indexOf("if (!asking)"), src.indexOf("role=\"alertdialog\""));
    expect(collapsed).toContain("disabled={pending || disabled}");
  });
});
