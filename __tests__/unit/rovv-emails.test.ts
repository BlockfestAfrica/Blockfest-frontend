/**
 * Rovv's two emails: the entry receipt and the winner's notice.
 *
 * What these hold is that they speak for Rovv's campaign and nobody else's
 * (an entrant never signed up to Monica, so a footer saying so or linking her
 * rules tells them the wrong thing about what they agreed to), that what
 * people typed is escaped exactly once, and that Monica's own mail did not
 * change when the layout learned a second brand.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  rovvEligibleEmail,
  rovvEntryAlertEmail,
  rovvEntryEmail,
  rovvIneligibleEmail,
  rovvWinnerEmail,
  submissionReceivedEmail,
} from "@/lib/email/templates";

const winner = (over: Partial<Parameters<typeof rovvWinnerEmail>[0]> = {}) =>
  rovvWinnerEmail({
    to: "a@example.test",
    fullName: "Ada Obi",
    tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD",
    ticketCode: "BUIDL-ADA-1",
    ticketLink: "https://meetumo.ai/e/blockfest-africa-2026?utm_source=blockfestafrica.com",
    ...over,
  });
const ineligible = (canFix: boolean) =>
  rovvIneligibleEmail({
    to: "a@example.test",
    fullName: "Ada <b>Obi</b>",
    tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD",
    reason: "Not tagging @rovvafrica & <script>",
    canFix,
  });

const ORIGINAL = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

const entry = (replaced = false) =>
  rovvEntryEmail({
    to: "ada@example.test",
    fullName: "Tom & <Jerry>",
    tiktokUrl: "https://tiktok.com/@tom/video/7300000000000000001",
    referralCode: "ABC123",
    replaced,
  });

describe("Rovv's emails", () => {
  it("speak for Rovv's campaign, link its rules, and never mention Monica", () => {
    const all = [
      entry(),
      entry(true),
      winner(),
      rovvEligibleEmail({ to: "a@example.test", fullName: "Ada", tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD" }),
      ineligible(true),
      ineligible(false),
      rovvEntryAlertEmail({ to: "o@example.test", who: "@adaobi", waiting: 3, consoleUrl: "https://blockfestafrica.com/admin/rovv" }),
    ];
    for (const mail of all) {
      expect(mail.html).toContain("If ROVV Takes Me to Blockfest");
      expect(mail.html).toContain("for the ROVV campaign");
      expect(mail.html).toContain("https://blockfestafrica.com/campaigns/rovv/rules");
      expect(mail.html).toContain("https://blockfestafrica.com/campaigns/rovv/privacy");
      expect(mail.html + mail.text + mail.subject).not.toMatch(/monica/i);
    }
  });

  it("escape a name once, and never twice", () => {
    const mail = entry();
    expect(mail.html).toContain("Tom");
    expect(mail.html).not.toContain("<Jerry>");
    expect(mail.html).not.toContain("&amp;amp;");
    expect(mail.toName).toBe("Tom & <Jerry>");
  });

  it("read back the video and the code, and say whether it replaced one", () => {
    expect(entry().subject).toBe("We got your ROVV entry");
    expect(entry(true).subject).toBe("Your ROVV entry is updated");
    expect(entry(true).text).toMatch(/replaces the one you sent before/);
    for (const mail of [entry(), entry(true)]) {
      expect(mail.text).toContain("https://tiktok.com/@tom/video/7300000000000000001");
      expect(mail.text).toContain("ABC123");
      expect(mail.html).toContain("ABC123");
    }
  });

  it("give the dates on the right weekdays", () => {
    const text = entry().text + winner().text + ineligible(true).text;
    expect(text).toContain("Sunday 18 October");
    expect(text).toContain("4 PM on Monday 19 October");
    expect(text).toContain("Friday 23 October");
    expect(text).not.toMatch(/Saturday 18|Monday 20|Tuesday 21|Sunday 19|Thursday 23/);
    // No claim deadline any more (the owner, 12 October).
    expect(text).not.toMatch(/Tuesday 20|Wednesday 21|6:00 PM/);
    // The rules' own date for keeping the video up, not a vaguer one.
    expect(entry().text).toContain("Keep the video public and tagged until Saturday 24 October.");
  });

  it("give a winner their own code and the one step that turns it into a pass", () => {
    const mail = winner();
    expect(mail.subject).toBe("You won a BUIDL PASS with ROVV");
    expect(mail.text).toContain("Your code: BUIDL-ADA-1");
    expect(mail.html).toContain("BUIDL-ADA-1");
    expect(mail.text).toContain("Register here: https://meetumo.ai/e/blockfest-africa-2026");
    expect(mail.text).toMatch(/Day 2, Conference Day, on Friday 23 October/);
    expect(mail.text).toMatch(/full price off/);
    expect(mail.html).not.toMatch(/\?t=|\/enter\b/);
  });

  it("say an eligible entry is in the running, never that it won", () => {
    const mail = rovvEligibleEmail({ to: "a@example.test", fullName: "Ada", tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD" });
    expect(mail.subject).toBe("Your ROVV entry is in the running");
    expect(mail.text + mail.subject).not.toMatch(/you won|winner\b(?! )/i);
  });

  it("give the reason for a ruling-out, escaped, and the way to fix it only while that is possible", () => {
    const open = ineligible(true);
    const shut = ineligible(false);
    expect(open.subject).toBe("Your ROVV entry needs a fix");
    expect(open.text).toContain("Why: Not tagging @rovvafrica & <script>");
    expect(open.html).toContain("Not tagging @rovvafrica &amp; &lt;script&gt;");
    expect(open.html).not.toContain("<script>");
    expect(open.html).toContain("/campaigns/rovv#enter");
    expect(shut.subject).toBe("About your ROVV entry");
    expect(shut.text).toMatch(/Entries have closed/);
    expect(shut.html).not.toContain("Fix my entry");
  });

  it("tell the team who entered and how much is waiting, with no entrant email in it", () => {
    const mail = rovvEntryAlertEmail({ to: "o@example.test", who: "@adaobi (test)", waiting: 1, alsoSince: 4, consoleUrl: "https://blockfestafrica.com/admin/rovv" });
    expect(mail.subject).toBe("New ROVV entry: @adaobi (test)");
    expect(mail.text).toContain("1 entry is waiting for review.");
    expect(mail.text).toContain("4 more came in");
    expect(mail.html).not.toContain("&amp;amp;");
  });
});

describe("Monica's emails", () => {
  it("still carry Monica's brand", () => {
    const mail = submissionReceivedEmail({
      to: "a@example.test",
      fullName: "Ada",
      weekNo: 3,
      platformLabel: "TikTok",
      url: "https://tiktok.com/@a/video/1",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.html).toContain("Monica: The Money Story");
    expect(mail.html).toContain("for the Monica campaign");
    expect(mail.html).toContain("/campaigns/monica-money-story/rules");
    expect(mail.html).not.toMatch(/rovv/i);
  });
});
