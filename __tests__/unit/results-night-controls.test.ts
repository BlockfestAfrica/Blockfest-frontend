import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The two console behaviours that only bite on results night.
 *
 * Comments are stripped before matching: this codebase explains its
 * decisions in prose, and an assertion that reads prose reports the thing
 * it is checking for as still present. That has now caught three tests.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const read = (p: string) => codeOnly(readFileSync(join(process.cwd(), p), "utf8"));

const VOTE = "components/admin/vote-round-panel.tsx";
const WINNERS = "components/admin/winners-panel.tsx";

describe("the sweep controls", () => {
  const src = read(VOTE);

  it("survive marking the review complete", () => {
    /*
     * They were gated on `reviewed`, which deleted the held list, the
     * clusters and the vote lookup at the exact moment they matter most:
     * between certifying and announcing, when a nominee can still report a
     * farmed cluster.
     *
     * The engine disagreed with the screen. remove_vote has no reviewed
     * check, and vote_tally is a live view, so a removal moves the tally
     * and therefore moves who publish_weekly_winner will accept (P0806).
     */
    expect(src).not.toMatch(/\{!reviewed && signalsBlock\}/);
    expect(src).toMatch(/status !== "published" && signalsBlock/);
  });

  it("stop once the winner is public, when nothing is left to change", () => {
    expect(src).toContain('!== "published"');
  });

  it("keeps the held count visible for the same window", () => {
    expect(src).not.toMatch(/heldCount > 0 && !reviewed/);
  });
});

describe("the announce control", () => {
  const src = read(WINNERS);

  it("is not offered before it can succeed", () => {
    // It was gated on nothing while Save as draft was gated on `ready`, so
    // the only live button on an untouched screen was the irreversible one.
    expect(src).toMatch(/ready && frozen \?/);
  });

  it("never asks to announce a creator with no prize set", () => {
    // The question read "...with no prize set?" and the button under it
    // said "Yes, announce it". A confirmation describing something that
    // cannot happen teaches people to click through confirmations.
    expect(src).not.toContain("no prize set");
    expect(src).not.toMatch(/Yes, announce \$\{ready \?/);
  });

  it("still allows a draft before the standings are recorded", () => {
    // The engine permits it and it is a real Saturday workflow.
    expect(src).toMatch(/disabled=\{busy \|\| !ready\}/);
  });

  it("says which of the two things is missing", () => {
    expect(src).toContain("Record the standings for this week before announcing.");
    expect(src).toContain("Pick a creator and enter the prize to continue.");
  });
});
