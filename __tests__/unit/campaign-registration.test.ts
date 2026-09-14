/**
 * Tests for registration validation.
 *
 * This is the anti-fraud layer, not a form-polish layer. Points convert to
 * money and referrals pay for bringing people in, so the cheapest attack on
 * both is one person registering as several. The database refuses duplicates,
 * but a unique index only catches what it sees as identical, and
 * `A.B+monica@gmail.com` and `ab@gmail.com` are one mailbox. Everything here
 * exists to make those compare equal before they reach the constraint.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalEmail,
  canonicalHandle,
  canonicalPhone,
  looksAutomated,
  MIN_HUMAN_FILL_MS,
  refFromQuery,
  registrationSchema,
  resolveReferralCode,
} from "@/lib/campaign-registration";

describe("canonicalEmail", () => {
  it("treats gmail dot and plus tricks as one mailbox", () => {
    // The whole reason this function exists. Without it, one inbox yields
    // unlimited accounts for the cost of typing a plus sign.
    const forms = [
      "A.B+monica@gmail.com",
      "ab@gmail.com",
      "a.b@GMAIL.com",
      "a.b+anything+else@gmail.com",
    ];
    const canonical = forms.map(canonicalEmail);
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe("ab@gmail.com");
  });

  it("applies the same rule to googlemail, which is the same service", () => {
    // Folded onto gmail.com since the day-one audit: googlemail.com is the
    // same inbox, and without the fold one mailbox made two unique accounts.
    expect(canonicalEmail("a.b@googlemail.com")).toBe("ab@gmail.com");
  });

  it("does not strip dots for providers that treat them as significant", () => {
    // Outlook and most hosts consider a.b@ and ab@ different people, so
    // stripping dots there would merge two real creators into one.
    expect(canonicalEmail("a.b@outlook.com")).toBe("a.b@outlook.com");
    expect(canonicalEmail("first.last@company.com")).toBe(
      "first.last@company.com",
    );
  });

  it("still drops a +tag on providers that keep dots", () => {
    expect(canonicalEmail("a.b+monica@outlook.com")).toBe("a.b@outlook.com");
  });

  it("leaves a leading dot-free address alone", () => {
    expect(canonicalEmail("  Someone@Example.COM ")).toBe(
      "someone@example.com",
    );
  });
});

describe("canonicalPhone", () => {
  it("reads the same Nigerian number written four ways as one number", () => {
    const forms = [
      "08012345678",
      "+2348012345678",
      "2348012345678",
      "0801 234 5678",
    ];
    const canonical = forms.map(canonicalPhone);
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe("+2348012345678");
  });

  it("keeps an international number in the country it was given", () => {
    // The campaign is open beyond Nigeria, so a +44 number must not be
    // rewritten into a Nigerian one.
    expect(canonicalPhone("+44 7700 900123")).toBe("+447700900123");
    expect(canonicalPhone("+1 415 555 0123")).toBe("+14155550123");
  });

  it("refuses a number it would have to guess at", () => {
    // No country code and no leading zero. Returning null sends the creator
    // back to fix it, which is better than inventing a country for them.
    expect(canonicalPhone("8012345678")).toBeNull();
    expect(canonicalPhone("")).toBeNull();
    expect(canonicalPhone("abc")).toBeNull();
  });

  it("refuses lengths that cannot be a phone number", () => {
    expect(canonicalPhone("+1234")).toBeNull();
    expect(canonicalPhone("+12345678901234567890")).toBeNull();
  });
});

describe("canonicalHandle", () => {
  it("reads a handle, an @handle and a pasted profile URL as one account", () => {
    // Creators paste whatever is in front of them. All of these are one person.
    const forms = [
      "MyName",
      "@MyName",
      "https://x.com/MyName",
      "https://www.instagram.com/myname/",
      "https://www.tiktok.com/@MyName?lang=en",
    ];
    expect(new Set(forms.map(canonicalHandle)).size).toBe(1);
    expect(canonicalHandle(forms[0])).toBe("myname");
  });

  it("drops repeated @ signs", () => {
    expect(canonicalHandle("@@myname")).toBe("myname");
  });
});

const valid = {
  fullName: "Ada Creator",
  email: "ada@example.com",
  phone: "08012345678",
  x: "adacreates",
  instagram: "",
  tiktok: "",
  monicaTag: "adacreates",
  acceptedRules: true as const,
  rulesVersion: "1.0",
};

describe("the registration form", () => {
  it("accepts a creator with one account and consent", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a creator with no account to publish from", () => {
    // Nothing to submit an entry from, and no handle to verify ownership of.
    const result = registrationSchema.safeParse({ ...valid, x: "" });
    expect(result.success).toBe(false);
  });

  it("refuses without consent, and does not accept a merely truthy value", () => {
    // Consent has to be given before the record exists. It cannot be inferred
    // later, and "false" must not sneak through as a present field.
    expect(
      registrationSchema.safeParse({ ...valid, acceptedRules: false }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...valid, acceptedRules: "yes" }).success,
    ).toBe(false);
    const without = { ...valid } as Partial<typeof valid>;
    delete without.acceptedRules;
    expect(registrationSchema.safeParse(without).success).toBe(false);
  });

  it("records which version of the rules was agreed to", () => {
    // The rules can be amended mid-campaign, so "they accepted the rules" is
    // not an answer. Which wording they accepted is.
    const without = { ...valid } as Partial<typeof valid>;
    delete without.rulesVersion;
    expect(registrationSchema.safeParse(without).success).toBe(false);
  });

  it("refuses a phone number it cannot place", () => {
    expect(
      registrationSchema.safeParse({ ...valid, phone: "8012345678" }).success,
    ).toBe(false);
  });

  it("normalises handles on the way through, not just on the way in", () => {
    const result = registrationSchema.safeParse({
      ...valid,
      x: "https://x.com/AdaCreates",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.x).toBe("adacreates");
  });

  it("rejects a handle with characters no platform allows", () => {
    const result = registrationSchema.safeParse({
      ...valid,
      x: "not a handle!",
    });
    expect(result.success).toBe(false);
  });
});

describe("looksAutomated", () => {
  it("says nothing about a normal submission", () => {
    expect(looksAutomated({ hp_contact: "", elapsedMs: 45_000 })).toBeNull();
  });

  it("catches anything that filled the hidden field", () => {
    // No person can see or tab to it, so a value came from something filling
    // every input it found.
    expect(looksAutomated({ hp_contact: "https://spam.example" })).toBe(
      "honeypot",
    );
  });

  it("ignores whitespace in the hidden field", () => {
    // A stray space is not a bot, and treating it as one silently drops a real
    // registration.
    expect(looksAutomated({ hp_contact: "   ", elapsedMs: 30_000 })).toBeNull();
  });

  it("catches a form completed faster than a person could type it", () => {
    expect(looksAutomated({ elapsedMs: 40 })).toMatch(/^too-fast/);
  });

  it("allows a fast but plausible human", () => {
    // The threshold is deliberately low. Turning away a quick typist who pastes
    // from notes is worse than letting through a bot that waits.
    expect(looksAutomated({ elapsedMs: MIN_HUMAN_FILL_MS + 1 })).toBeNull();
  });

  it("does not punish a submission with no timing at all", () => {
    // Timing can be missing for reasons that are not a bot's fault: a restored
    // tab, a hydration that ran late. Absence is not evidence.
    expect(looksAutomated({})).toBeNull();
  });

  it("reports the reason rather than a bare true, so it can be logged", () => {
    expect(looksAutomated({ elapsedMs: 10 })).toContain("10ms");
  });
});

describe("the honeypot in the parsed form", () => {
  it("is accepted as an ordinary optional field", () => {
    // It has to parse, not be rejected by validation, or the bot check never
    // runs and the schema does the rejecting with a visible error instead.
    const result = registrationSchema.safeParse({ ...valid, hp_contact: "x" });
    expect(result.success).toBe(true);
  });
});

/**
 * A ?ref on the register page's own URL.
 *
 * /register?ref=CODE is the link people build by hand from the URL they can
 * see, and it used to be dropped without a word: the visitor registered fine
 * and the referrer was never credited. Whatever passes this check is prefilled
 * into a visible input, so the check is also what keeps arbitrary query
 * strings out of the one box a creator is asked to trust.
 */
describe("refFromQuery", () => {
  it("accepts a code and folds it to upper case, as /join does", () => {
    // Codes are minted from an uppercase alphabet, and a lower-case one on a
    // URL is a code somebody retyped. Folding here keeps the prefill
    // consistent with the cookie and with what the input enforces as you type.
    expect(refFromQuery("rq4963zv")).toBe("RQ4963ZV");
    expect(refFromQuery("  RQ4963ZV  ")).toBe("RQ4963ZV");
  });

  it("refuses anything not shaped like a code", () => {
    // None of these are codes anyone was given. They are probing, or a
    // mangled link, and every one of them would otherwise be rendered into a
    // visible input as if we vouched for it.
    expect(refFromQuery("../../etc/passwd")).toBe("");
    expect(refFromQuery("<script>alert(1)</script>")).toBe("");
    expect(refFromQuery("RQ49 63ZV")).toBe("");
    expect(refFromQuery("A".repeat(500))).toBe("");
    expect(refFromQuery("")).toBe("");
  });

  it("caps the length at the visible field's own limit", () => {
    // Minted codes are eight characters and the input stops typing at
    // sixteen. A seventeen-character string is not one of ours, and
    // prefilling it would show a creator junk they never typed.
    expect(refFromQuery("A".repeat(16))).toBe("A".repeat(16));
    expect(refFromQuery("A".repeat(17))).toBe("");
  });

  it("refuses a repeated parameter rather than guessing", () => {
    // ?ref twice on one URL came from tooling, not from a forwarded message.
    // Picking one would be inventing an attribution.
    expect(refFromQuery(["RQ4963ZV", "AB23CD45"])).toBe("");
    expect(refFromQuery(undefined)).toBe("");
  });
});

/**
 * Which code a registration is credited to when the field and the cookie
 * disagree.
 *
 * The order flipped when the field became always visible. These tests are
 * what hold the flip: run with the old cookie-first order injected, the first
 * of them fails by name.
 */
describe("resolveReferralCode", () => {
  it("lets the visible field beat the cookie", () => {
    // The field is on the page, prefilled, and editable. If a hidden cookie
    // could override what the creator sees and has corrected, the interface
    // would be lying about which referrer gets the credit.
    expect(resolveReferralCode({ typed: "AB23CD45", cookie: "RQ4963ZV" })).toBe(
      "AB23CD45",
    );
  });

  it("falls back to the cookie only when the field never travelled", () => {
    // A /join arrival that submits without the field still carries the
    // click that was recorded. But a PRESENT empty field is a person who
    // deleted the prefilled code: that is a decision, and the old
    // fallthrough silently reinstated the credit from the cookie.
    expect(resolveReferralCode({ cookie: "RQ4963ZV" })).toBe("RQ4963ZV");
    expect(resolveReferralCode({ typed: "", cookie: "RQ4963ZV" })).toBe("");
    expect(resolveReferralCode({ typed: "   ", cookie: "RQ4963ZV" })).toBe("");
  });

  it("resolves to empty when neither source has a code", () => {
    // Empty is empty. The route turns it into null so an empty string never
    // reaches the database looking like a code that failed to resolve.
    expect(resolveReferralCode({})).toBe("");
    expect(resolveReferralCode({ typed: "", cookie: "  " })).toBe("");
  });
});

describe("the referral wiring", () => {
  /*
   * The pattern this repository keeps rediscovering: a helper written, tested
   * in isolation, and called by nothing. The honeypot did it, the throttle
   * did it. These read the source of the two call sites, so the helpers above
   * cannot quietly stop being the code that runs.
   */
  it("the register page reads ?ref through refFromQuery and hands it to the form", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/campaigns/monica-money-story/register/page.tsx"),
      "utf8",
    );
    expect(src, "the page must validate the ref it reads").toContain(
      "refFromQuery(",
    );
    expect(src, "and must pass the result to the form").toContain(
      "initialRef={initialRef}",
    );
  });

  it("the register route resolves the code through resolveReferralCode", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/api/campaigns/monica/register/route.ts"),
      "utf8",
    );
    expect(src, "the route must use the shared precedence").toContain(
      "resolveReferralCode(",
    );
  });
});
