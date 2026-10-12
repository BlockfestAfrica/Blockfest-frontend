/**
 * Rovv's rules and privacy notice, checked against the form and the route
 * they describe, the way Monica's are.
 *
 * The notice has one promise Monica's does not: the sponsor receives
 * personal details. It must name exactly which, and the form must say the
 * same beside the box people tick.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";
import { ROVV, rovvEntryFields } from "@/lib/rovv";
import { rovvPrivacyCollected, rovvPrivacySections, ROVV_PRIVACY_UPDATED, ROVV_PRIVACY_VERSION } from "@/lib/rovv-privacy";
import { rovvRules, rovvRulesOpenPoints, ROVV_RULES_UPDATED, ROVV_RULES_VERSION } from "@/lib/rovv-rules";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const ROUTE = read("app/api/campaigns/rovv/enter/route.ts");
const FORM = read("components/campaigns/rovv-entry-form.tsx");
const PAGE = read("app/campaigns/rovv/page.tsx");

const notice = [
  ...rovvPrivacyCollected.flatMap((c) => [c.what, c.why]),
  ...rovvPrivacySections.flatMap((s) => [s.title, ...s.paragraphs]),
].join(" ");
const rules = rovvRules.flatMap((s) => [s.title, ...s.paragraphs]).join(" ");

describe("the privacy notice", () => {
  it("describes every field the form takes", () => {
    const plumbing = new Set(["hp_contact", "elapsedMs", "acceptedRules", "rulesVersion", "privacyVersion"]);
    const described: Record<string, RegExp> = {
      fullName: /full name/i,
      email: /email address/i,
      tiktokHandle: /TikTok username/i,
      tiktokUrl: /link to your TikTok video/i,
      referralCode: /referral code/i,
      marketingOptIn: /future Blockfest Africa campaigns/i,
    };
    for (const field of Object.keys(rovvEntryFields.shape).filter((f) => !plumbing.has(f))) {
      expect(described[field], `no wording mapped for "${field}"`).toBeTruthy();
      expect(notice, `notice does not describe "${field}"`).toMatch(described[field]);
    }
  });

  it("names, as automatic, what the route records without anyone typing it", () => {
    expect(ROUTE).toMatch(/x-nf-client-connection-ip/);
    expect(ROUTE).toMatch(/user-agent/);
    const automatic = rovvPrivacyCollected.filter((c) => c.automatic).map((c) => c.what);
    expect(automatic.some((w) => /IP address/i.test(w))).toBe(true);
    expect(automatic.some((w) => /user agent/i.test(w))).toBe(true);
  });

  it("says exactly what ROVV receives, and the form says the same", () => {
    const sharing = rovvPrivacySections.find((s) => s.id === "sharing")!.paragraphs.join(" ");
    expect(sharing).toMatch(/ROVV[^.]*receives your name, email address, TikTok username and ROVV referral code/);
    expect(sharing).toMatch(/for that check and for nothing else/);
    // Winners register their own pass with a code; we pass the ticketing provider nothing.
    expect(sharing).toMatch(/we pass it nothing about you/);
    expect(FORM).toMatch(/shares my name, email address, TikTok username and referral code\s+with ROVV/);
  });

  it("answers what the NDPA asks", () => {
    expect(notice).toMatch(/Tevah Synergy/);
    expect(notice).toMatch(/consent/i);
    expect(notice).toMatch(/legitimate interest/i);
    expect(notice).toMatch(/\d+ months/);
    expect(notice).not.toMatch(/indefinitely|forever/i);
    expect(notice).toMatch(/Nigeria Data Protection Commission/);
    expect(notice).toContain(PRIVACY_CONTACT);
  });

  it("is versioned and dated", () => {
    expect(ROVV_PRIVACY_VERSION).toMatch(/^\d+\.\d+$/);
    expect(Number.isNaN(new Date(ROVV_PRIVACY_UPDATED).getTime())).toBe(false);
  });
});

describe("the rules", () => {
  it.each([
    ["the age and the city", /18 or over[^.]*Lagos/],
    ["the window, in Lagos time", /13 October 2026[^.]*18 October 2026, Lagos time/],
    ["one entry each", /once, with one video/],
    ["how to replace an entry", /same email address and the same TikTok username/],
    ["the ROVV registration as a condition", /condition of entry/],
    ["the tags and hashtag", /@rovvafrica[^.]*@blockfestafrica[^.]*#ROVVMeToBlockfest/],
    ["how many win, and on what", /20 winners for creativity and relevance/],
    ["that engagement does not decide it", /Views, likes and follower counts do not decide it/],
    ["the prize, and which day it is for", /one BUIDL PASS[^.]*Day 2, Conference Day, on Friday 23 October 2026/],
    ["how a winner claims it, with no deadline", /code takes the full price off\. There is no deadline/],
    ["when winners are announced", /by 4:00 PM on Monday 19 October 2026/],
    ["that a ruled-out entry can be fixed", /rules your entry out, we email you the reason\. You can fix it/],
    ["that the code cannot become cash", /cannot be exchanged for cash/],
    ["what ROVV receives", /share your name, email address, TikTok username and referral code with ROVV/],
    ["road safety", /driving or riding/],
    ["the operator", /Tevah Synergy/],
  ])("state %s", (_, pattern) => {
    expect(rules).toMatch(pattern);
  });

  it("carry a version, a date, unique anchors and no empty clause", () => {
    expect(ROVV_RULES_VERSION).toMatch(/^\d+\.\d+$/);
    expect(Number.isNaN(new Date(ROVV_RULES_UPDATED).getTime())).toBe(false);
    const ids = rovvRules.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of rovvRules) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.paragraphs.length, s.id).toBeGreaterThan(0);
    }
    expect(Array.isArray(rovvRulesOpenPoints)).toBe(true);
  });

  it("agree with the page on the numbers people decide on", () => {
    expect(rules).toContain(String(ROVV.winners));
    expect(PAGE).toMatch(/Saturday 24 October 2026/);
    expect(rules).toMatch(/Saturday 24 October 2026/);
  });

  it("set no em dash anywhere a reader sees", () => {
    expect(rules + notice).not.toContain("—");
  });
});
