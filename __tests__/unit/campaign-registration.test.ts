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
  registrationSchema,
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
    expect(canonicalEmail("a.b@googlemail.com")).toBe("ab@googlemail.com");
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
  contentNiche: "Finance explainers",
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
