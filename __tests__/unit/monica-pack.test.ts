/**
 * The Creator Pack, checked against the distinctions it exists to protect.
 *
 * Monica is a financial business, and the claims most likely to cause trouble
 * are the ones a creator would get wrong in good faith by rounding a careful
 * phrase up to a familiar one. Monica says it is "aligned with" the SEC's
 * Virtual Asset Service Provider framework, never licensed or regulated by it.
 * It converts one way and is not a custodian. Nothing about it is insured.
 *
 * Each of those survives only as long as the pack keeps saying it, so each one
 * is asserted here rather than trusted to a careful edit later.
 */

import { describe, expect, it } from "vitest";
import {
  monicaPackAllowed,
  monicaPackFacts,
  monicaPackOpenPoints,
  monicaPackPrinciple,
  monicaPackProhibited,
  monicaPackSections,
  MONICA_PACK_VERSION,
} from "@/lib/monica-pack";
import { campaignBySlug, MONICA_SLUG } from "@/lib/campaigns";

const facts = monicaPackFacts.map((f) => `${f.label} ${f.detail}`).join(" ");
const prohibited = monicaPackProhibited.join(" ");
const allText = [
  monicaPackPrinciple,
  facts,
  ...monicaPackAllowed,
  ...monicaPackProhibited,
  ...monicaPackSections.flatMap((s) => [s.title, ...s.paragraphs]),
].join(" ");

describe("the regulatory wording", () => {
  it("uses Monica's own phrase and not a stronger one", () => {
    expect(facts).toMatch(/aligned with/i);
  });

  it("forbids upgrading that phrase to licensed or regulated", () => {
    expect(prohibited).toMatch(/licensed/i);
    expect(prohibited).toMatch(/regulated/i);
  });

  it("never itself claims Monica is licensed or regulated by anyone", () => {
    // The allow list and the principle are copied from directly, so any mention
    // of a regulatory status there would hand a creator the exact claim the
    // prohibitions forbid.
    const copyable = [monicaPackPrinciple, ...monicaPackAllowed].join(" ");
    expect(copyable).not.toMatch(/licen[cs]|regulated|approved by/i);
  });

  it("states the regulatory position only as a negation", () => {
    // The facts do mention licensing, because saying what Monica is not is the
    // clearest way to stop somebody claiming it. What must never appear is an
    // affirmative: "licensed by" with no "not" in front of it.
    const regulatory = monicaPackFacts.find((f) => /regulatory/i.test(f.label));
    expect(regulatory).toBeTruthy();
    expect(regulatory!.detail).toMatch(
      /not licensed, registered, approved or regulated by/i,
    );
    expect(regulatory!.detail).not.toMatch(
      /(?<!not )(is|are) (licensed|regulated|approved)/i,
    );
  });
});

describe("what Monica is not", () => {
  it("forbids calling it a bank or saying anything is insured", () => {
    expect(prohibited).toMatch(/bank/i);
    expect(prohibited).toMatch(/insured/i);
  });

  it("forbids describing it as a place to buy, hold or store crypto", () => {
    // It is a one-way off ramp and its terms say title passes to Monica on
    // confirmation, so custody language describes a product that is not there.
    expect(prohibited).toMatch(/buy crypto/i);
    expect(prohibited).toMatch(/hold, store|store/i);
  });

  it("describes the direction of the conversion as one way", () => {
    expect(facts).toMatch(/one-way|one way/i);
  });
});

describe("the fee wording", () => {
  it("states the zero platform fee and the network fee together", () => {
    // 0% is true and publishable. "Free" is not, because the sender still pays
    // gas, so the two facts have to travel together.
    const fee = monicaPackFacts.find((f) => /fee/i.test(f.label));
    expect(fee).toBeTruthy();
    expect(fee!.detail).toMatch(/0%/);
    expect(fee!.detail).toMatch(/network fee|gas/i);
  });

  it("forbids calling the conversion free without mentioning network fees", () => {
    expect(prohibited).toMatch(/free/i);
  });
});

describe("eligibility, which the campaign and the product do not share", () => {
  /**
   * The campaign is open to creators anywhere. Monica requires Nigerian
   * residency and a Nigerian bank account. So a creator outside Nigeria can
   * enter every challenge and cannot open an account, and an entry describing
   * first-hand use would be a fabricated testimonial.
   */
  it("says the campaign is not limited to Nigeria", () => {
    const published = campaignBySlug(MONICA_SLUG);
    expect(published).toBeTruthy();
    const section = monicaPackSections.find((s) => s.id === "outside-nigeria");
    expect(section, "the pack must address creators outside Nigeria").toBeTruthy();
    expect(section!.paragraphs.join(" ")).toMatch(/open to creators anywhere/i);
  });

  it("says Monica itself requires Nigerian residency", () => {
    expect(facts).toMatch(/ordinarily resident in Nigeria/i);
  });

  it("forbids inventing a first-hand account of using it", () => {
    const section = monicaPackSections.find((s) => s.id === "outside-nigeria");
    expect(section!.paragraphs.join(" ")).toMatch(
      /not describe using the app if you have not used it/i,
    );
  });
});

describe("what is still unknown", () => {
  it("no longer lists product facts Monica has already published", () => {
    // These were open points before Monica's terms were found. Leaving them
    // listed would tell creators they may not state things that are now
    // confirmed on this very page.
    const open = monicaPackOpenPoints.join(" ");
    expect(open).not.toMatch(/fees, exchange rates, transfer times or limits/i);
    expect(open).not.toMatch(/approved description of what Monica does/i);
  });

  it("still names the things the published documents do not answer", () => {
    expect(monicaPackOpenPoints.length).toBeGreaterThan(0);
    expect(monicaPackOpenPoints.join(" ")).toMatch(/brand assets/i);
  });
});

describe("house style", () => {
  it("is versioned", () => {
    expect(MONICA_PACK_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it("uses no em dashes", () => {
    expect(allText).not.toContain("—");
  });
});
