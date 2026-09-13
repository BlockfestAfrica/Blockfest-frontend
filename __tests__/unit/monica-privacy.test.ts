/**
 * The privacy notice, checked against the thing it describes.
 *
 * A notice is not judged on being present. It is judged on being complete and
 * true, and the way it goes wrong is by quietly omitting something: the reader
 * takes the list as exhaustive, which is exactly what makes a partial one worse
 * than none at all.
 *
 * The two items most likely to be left out are the ones nobody typed. The form
 * never mentions that an IP address and a user agent are recorded, so nothing
 * else in the codebase would notice if the notice stopped mentioning them
 * either. These assertions read the registration schema and the route to work
 * out what is actually collected, rather than repeating a list by hand.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  monicaPrivacyCollected,
  monicaPrivacySections,
  MONICA_PRIVACY_VERSION,
  PRIVACY_CONTACT,
} from "@/lib/monica-privacy";
import { registrationSchema } from "@/lib/campaign-registration";

const ROUTE = readFileSync(
  join(process.cwd(), "app/api/campaigns/monica/register/route.ts"),
  "utf8",
);

const allText = [
  ...monicaPrivacyCollected.flatMap((c) => [c.what, c.why]),
  ...monicaPrivacySections.flatMap((s) => [s.title, ...s.paragraphs]),
].join(" ");

describe("what the notice says is collected", () => {
  it("covers every field the registration schema accepts", () => {
    // Fields that are plumbing rather than personal data: the honeypot, the
    // timing measurement, the referral code and the two version strings are
    // described in their own sections rather than as collected details.
    const plumbing = new Set([
      "hp_contact",
      "elapsedMs",
      "ref",
      "acceptedRules",
      "rulesVersion",
      "marketingOptIn",
      "privacyVersion",
    ]);

    const described: Record<string, RegExp> = {
      fullName: /name/i,
      email: /email/i,
      phone: /phone/i,
      x: /handle/i,
      instagram: /handle/i,
      tiktok: /handle/i,
      monicaTag: /monica tag/i,
      audienceSize: /audience/i,
      location: /where you are|location/i,
    };

    const fields = Object.keys(registrationSchema.shape).filter(
      (f) => !plumbing.has(f),
    );

    for (const field of fields) {
      const pattern = described[field];
      expect(pattern, `no privacy wording mapped for "${field}"`).toBeTruthy();
      expect(allText, `notice does not describe "${field}"`).toMatch(pattern);
    }
  });

  /**
   * The route records these without the form ever saying so, which is exactly
   * why they have to be named here.
   */
  it("names the things recorded without anybody typing them", () => {
    // Read from the route rather than assumed, so that if it ever stops
    // capturing these the notice stops claiming it does, and if it starts
    // capturing something else this test is where that gets noticed.
    expect(ROUTE).toMatch(/x-nf-client-connection-ip|x-forwarded-for/);
    expect(ROUTE).toMatch(/user-agent/i);

    expect(allText).toMatch(/IP address/i);
    expect(allText).toMatch(/user agent/i);
  });

  it("flags those as automatic rather than burying them in the list", () => {
    const automatic = monicaPrivacyCollected.filter((c) => c.automatic);
    expect(automatic.length).toBeGreaterThanOrEqual(2);
    expect(automatic.some((c) => /IP address/i.test(c.what))).toBe(true);
    expect(automatic.some((c) => /user agent/i.test(c.what))).toBe(true);
  });
});

describe("the notice answers what the NDPA requires", () => {
  it("names the controller", () => {
    expect(allText).toMatch(/Tevah Synergy/);
  });

  it("gives a lawful basis for each purpose, marketing separately", () => {
    expect(allText).toMatch(/consent/i);
    expect(allText).toMatch(/legitimate interest/i);
  });

  it("states a retention period rather than keeping things forever", () => {
    // "Indefinitely" is not a period. The NDPA expects one tied to a purpose,
    // and open-ended marketing retention is only defensible because it can be
    // ended on request at any time.
    expect(allText).not.toMatch(/indefinitely|forever/i);
    expect(allText).toMatch(/\d+ months/);
  });

  it("says how to withdraw consent and how to complain", () => {
    expect(allText).toMatch(/until you tell us to stop|withdraw/i);
    expect(allText).toMatch(/Nigeria Data Protection Commission/);
  });

  it("gives an address to write to", () => {
    expect(allText).toContain(PRIVACY_CONTACT);
  });

  it("is versioned, so it is answerable which notice was in force", () => {
    expect(MONICA_PRIVACY_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe("what the notice promises about the sponsor", () => {
  it("states plainly that Monica does not get personal details", () => {
    const sharing = monicaPrivacySections.find((s) => s.id === "sharing");
    expect(sharing).toBeTruthy();
    expect(sharing!.paragraphs.join(" ")).toMatch(
      /Monica[^.]*does not receive your personal details/i,
    );
  });
});

describe("house style", () => {
  it("uses no em dashes", () => {
    expect(allText).not.toContain("—");
  });
});
