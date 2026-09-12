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
  MONICA_BRAND_ASSETS_URL,
  monicaChannels,
  monicaPackAllowed,
  monicaPackDisclosure,
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

/*
 * This block used to assert that the pack published "0% platform fee, and you
 * still pay gas", taken from Monica's Terms of Service clause 7.1 and 7.2.
 *
 * Monica's sponsor brief then said zero gas fees, and, a few lines earlier,
 * $2 gas fee for BTC and zero on other coins. Three statements that cannot all
 * be true. The rule this asserted is now known to be unsafe, so it is replaced
 * rather than adjusted: see "fees, which are unresolved" below. Publishing any
 * figure while the source contradicts itself is the mistake, not publishing the
 * wrong one.
 */
describe("the fee wording", () => {
  it("publishes no fee fact at all while the source disagrees with itself", () => {
    const fee = monicaPackFacts.find((f) => /fee/i.test(f.label));
    expect(
      fee,
      "there must be no fee fact until Monica settles which of their statements is right",
    ).toBeUndefined();
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
    // The assets themselves are now linked, so the open point is no longer
    // "we have no logo". It is that having a logo does not tell a creator how
    // it may be used, which is the part that gets an entry rejected.
    expect(monicaPackOpenPoints.length).toBeGreaterThan(0);
    expect(monicaPackOpenPoints.join(" ")).toMatch(
      /clear space|minimum size|coloured background/i,
    );
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

/**
 * The facts Monica supplied on 12 September, and the one they did not settle.
 */
describe("Monica's approved messaging", () => {
  it("uses their own product wording rather than ours", () => {
    expect(facts).toMatch(/crypto to naira/i);
    expect(facts).toMatch(/PADI CHOP I CHOP/);
    expect(facts).toMatch(/3,000 naira/);
  });

  it("names the coins they actually support", () => {
    for (const coin of ["Bitcoin", "Solana", "Ethereum", "BNB", "Tron", "USDT", "USDC"]) {
      expect(facts).toContain(coin);
    }
  });

  it("states plainly what Monica is not, since that is what gets got wrong", () => {
    // Their own brief singles this out: people describe it as converting
    // dollars, or as storing coins, and it does neither.
    expect(facts).toMatch(/does not convert naira to crypto/i);
    expect(facts).toMatch(/does not store coins/i);
  });

  it("forbids claiming dollars can be converted", () => {
    expect(prohibited).toMatch(/dollars, or any currency other than crypto/i);
  });

  /**
   * Monica calls itself the number one crypto app. That is their claim to
   * make about themselves. A creator asserting it as a fact of their own is
   * making a comparative advertising claim they cannot support.
   */
  it("allows the number one claim only as Monica's own words", () => {
    expect(prohibited).toMatch(/number one crypto app as a fact of your own/i);
  });
});

/**
 * The fee contradiction.
 *
 * Monica's Terms of Service clause 7.2 says the user bears the onchain network
 * fee on every chain. Their sponsor brief lists zero gas fees as a talking
 * point, and a few lines earlier says $2 gas fee for BTC and zero on other
 * coins. Three statements that cannot all be true, about the one subject where
 * being wrong is a false financial claim.
 *
 * Until Monica settles it, the pack must publish no fee figure at all, in
 * either direction. "Free" is as wrong as a wrong number.
 */
describe("fees, which are unresolved", () => {
  it("states no fee figure anywhere a creator could copy", () => {
    const copyable = [monicaPackPrinciple, facts, ...monicaPackAllowed].join(" ");
    expect(copyable).not.toMatch(/0%/);
    expect(copyable).not.toMatch(/zero (transfer |gas )?fee/i);
    expect(copyable).not.toMatch(/\$2/);
  });

  it("forbids a creator making one", () => {
    expect(prohibited).toMatch(/anything at all about fees/i);
  });

  it("keeps it on the open list until Monica settles it", () => {
    const open = monicaPackOpenPoints.join(" ");
    expect(open).toMatch(/fees/i);
    expect(open).toMatch(/7\.2|Terms of Service/);
  });
});

describe("tagging", () => {
  it("gives the real handles, since a near miss tags somebody else", () => {
    expect(monicaPackDisclosure.tag).toContain("@monicanigeria");
    expect(monicaPackDisclosure.tag).toContain("@monica_nigeria");
  });

  it("lists every channel with an https link", () => {
    expect(monicaChannels.length).toBeGreaterThanOrEqual(5);
    for (const channel of monicaChannels) {
      expect(channel.url).toMatch(/^https:\/\//);
      expect(channel.handle.length).toBeGreaterThan(0);
    }
  });
});

describe("brand assets", () => {
  it("links to Monica's own folder rather than copying files", () => {
    // Linking means a creator always gets the current logo. Copying means the
    // page is wrong the first time Monica replaces one and nobody notices.
    expect(MONICA_BRAND_ASSETS_URL).toMatch(/^https:\/\/drive\.google\.com\//);
  });

  it("no longer claims the folder is empty", () => {
    // It was not. That claim came from one query returning nothing, which is
    // not evidence of absence.
    const open = monicaPackOpenPoints.join(" ");
    expect(open).not.toMatch(/empty/i);
  });

  it("still asks for the thing the files do not answer", () => {
    // Having a logo is not the same as knowing how it may be used.
    const open = monicaPackOpenPoints.join(" ");
    expect(open).toMatch(/clear space|minimum size|coloured background/i);
  });
});
