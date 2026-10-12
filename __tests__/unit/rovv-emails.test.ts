/**
 * Rovv's emails, as an entrant and a winner receive them across the week:
 * the receipt, "in the running", "needs a fix", the winner's code, the
 * results, and the team's alert.
 *
 * What these hold: each speaks for Rovv's campaign and nobody else's (an
 * entrant never signed up to Monica), what people typed is escaped once, the
 * dates are on the right weekdays, the winner email walks a first-time buyer
 * through the code, and Monica's own mail did not change.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  rovvEligibleEmail,
  rovvEntryAlertEmail,
  rovvEntryEmail,
  rovvIneligibleEmail,
  rovvResultsEmail,
  rovvWinnerEmail,
  submissionReceivedEmail,
} from "@/lib/email/templates";

const ORIGINAL = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

const winner = (over: Partial<Parameters<typeof rovvWinnerEmail>[0]> = {}) =>
  rovvWinnerEmail({
    to: "a@example.test",
    fullName: "Ada Obi",
    tiktokHandle: "adaobi",
    tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD",
    ticketCode: "BUIDL-ADA-1",
    ticketLink: "https://meetumo.ai/e/blockfest-africa-2026?utm_source=blockfestafrica.com",
    ...over,
  });
const ineligible = (canFix: boolean, fixUrl?: string) =>
  rovvIneligibleEmail({
    to: "a@example.test",
    fullName: "Ada <b>Obi</b>",
    tiktokHandle: "adaobi",
    tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD",
    referralCode: "ada.123",
    reason: "Not tagging @rovvafrica & <script>",
    canFix,
    fixUrl,
  });
const eligible = () =>
  rovvEligibleEmail({ to: "a@example.test", fullName: "Ada", tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD", referralCode: "ada.123" });
const entry = (replaced = false) =>
  rovvEntryEmail({
    to: "ada@example.test",
    fullName: "Tom & <Jerry>",
    tiktokHandle: "tomjerry",
    tiktokUrl: "https://tiktok.com/@tom/video/7300000000000000001",
    referralCode: "ABC123",
    replaced,
  });

describe("Rovv's emails", () => {
  it("speak for Rovv's campaign, link its rules, and never mention Monica", () => {
    const all = [
      entry(),
      entry(true),
      eligible(),
      ineligible(true),
      ineligible(false),
      winner(),
      rovvResultsEmail({ to: "a@example.test", fullName: "Ada" }),
      rovvEntryAlertEmail({ to: "o@example.test", who: "@adaobi", waiting: 3, consoleUrl: "https://blockfestafrica.com/admin/rovv" }),
    ];
    for (const mail of all) {
      expect(mail.html, mail.subject).toContain("If ROVV Takes Me to Blockfest");
      expect(mail.html, mail.subject).toContain("for the ROVV campaign");
      expect(mail.html, mail.subject).toContain("https://blockfestafrica.com/campaigns/rovv/rules");
      expect(mail.html + mail.text + mail.subject, mail.subject).not.toMatch(/monica/i);
      // The campaign title is a heading, never dropped into a sentence where it reads as broken English.
      expect(mail.text, mail.subject).not.toMatch(/of If ROVV|to If ROVV/);
    }
  });

  it("escape a name once, and never twice", () => {
    const mail = entry();
    expect(mail.html).toContain("Tom");
    expect(mail.html).not.toContain("<Jerry>");
    expect(mail.html).not.toContain("&amp;amp;");
    expect(mail.toName).toBe("Tom & <Jerry>");
  });

  it("read back the username, the video and the code, and say how long the entry can still be changed", () => {
    expect(entry().subject).toBe("We got your ROVV entry");
    expect(entry(true).subject).toBe("Your ROVV entry is updated");
    for (const mail of [entry(), entry(true)]) {
      expect(mail.text).toContain("Your TikTok username: @tomjerry");
      expect(mail.text).toContain("https://tiktok.com/@tom/video/7300000000000000001");
      expect(mail.text).toContain("ABC123");
      expect(mail.text).toMatch(/Until the team has checked your entry/);
      expect(mail.text).toMatch(/After that, reply to this email/);
      expect(mail.text).toContain("Fix it here: https://blockfestafrica.com/campaigns/rovv#enter");
    }
  });

  it("give the dates on the right weekdays, and no claim deadline", () => {
    const text = entry().text + winner().text + ineligible(true).text + eligible().text;
    expect(text).toContain("Sunday 18 October");
    expect(text).toContain("4 PM on Monday 19 October");
    expect(text).toContain("Friday 23 October");
    expect(text).not.toMatch(/Saturday 18|Monday 20|Tuesday 21|Sunday 19|Thursday 23/);
    expect(text).not.toMatch(/Tuesday 20|Wednesday 21|6:00 PM/);
    expect(entry().text).toContain("Keep the video public and tagged until Saturday 24 October.");
  });

  it("say an eligible entry is in the running, locked in, and still subject to ROVV's check, never that it won", () => {
    const mail = eligible();
    expect(mail.subject).toBe("Your ROVV entry is in the running");
    expect(mail.text).toContain("Your ROVV referral code: ada.123");
    expect(mail.text).toMatch(/ROVV still confirms your referral code/);
    expect(mail.text).toMatch(/now locked in/);
    expect(mail.text + mail.subject).not.toMatch(/you won|you have won/i);
  });

  it("give the reason for a ruling-out as prose, escaped, with what to resend with, and the fix only while possible", () => {
    const open = ineligible(true);
    const shut = ineligible(false);
    expect(open.subject).toBe("Your ROVV entry needs a fix");
    expect(open.text).toContain("Why: Not tagging @rovvafrica & <script>");
    expect(open.html).toContain("Not tagging @rovvafrica &amp; &lt;script&gt;");
    expect(open.html).not.toContain("<script>");
    // Read, not copied: normal weight, no break-all on the reason.
    expect(open.html).toMatch(/line-height:1\.6;color:#16181d;">Not tagging/);
    expect(open.text).toContain("with this email address and the TikTok username @adaobi");
    expect(open.text).toContain("Your ROVV referral code: ada.123");
    expect(open.text).toContain("Fix it here: https://blockfestafrica.com/campaigns/rovv#enter");
    expect(open.text).toMatch(/reply to this email and a person will look at it again/);
    expect(shut.subject).toBe("About your ROVV entry");
    expect(shut.text).toMatch(/Entries have closed/);
    expect(shut.text).not.toContain("Fix it here");
    expect(shut.html).not.toContain("Fix my entry");
    expect(ineligible(true, "https://blockfestafrica.com/campaigns/rovv?test=1#enter").html).toContain("?test=1#enter");
  });

  it("give a winner their own code, the button under it, and the steps, with no prize-scam wording", () => {
    const mail = winner();
    expect(mail.subject).toBe("Your BUIDL PASS code: ROVV x Blockfest, Friday 23 October");
    expect(mail.text).toContain("Your code: BUIDL-ADA-1");
    expect(mail.html).toContain("BUIDL-ADA-1");
    expect(mail.html).toContain("Register with my code");
    expect(mail.text).toContain("Register with your code: https://meetumo.ai/e/blockfest-africa-2026");
    expect(mail.text).toMatch(/1\. Tap Register with my code/);
    expect(mail.text).toMatch(/discount or promo code/);
    expect(mail.text).toMatch(/Reply to this email with a screenshot/);
    expect(mail.text).toContain("Your username @adaobi is now on the campaign page");
    expect(mail.subject + mail.text).not.toMatch(/\bfree\b|\bclaim\b/i);
    expect(mail.html).not.toMatch(/\?t=|\/enter\b/);
  });

  it("thank everyone who did not win, and show them the winners", () => {
    const mail = rovvResultsEmail({ to: "a@example.test", fullName: "Ada Obi" });
    expect(mail.subject).toBe("The ROVV campaign winners are announced");
    expect(mail.text).toMatch(/was not one of them this time/);
    expect(mail.text).toContain("https://blockfestafrica.com/campaigns/rovv#winners");
  });

  it("tell the team who entered and how much is waiting", () => {
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
