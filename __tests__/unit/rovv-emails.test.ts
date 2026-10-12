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
import { rovvEntryEmail, rovvWinnerEmail, submissionReceivedEmail } from "@/lib/email/templates";

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
    for (const mail of [entry(), entry(true), rovvWinnerEmail({ to: "a@example.test", fullName: "Ada", tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD" })]) {
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
    const text = entry().text + rovvWinnerEmail({ to: "a@example.test", fullName: "Ada", tiktokUrl: "x" }).text;
    expect(text).toContain("Sunday 18 October");
    expect(text).toContain("Tuesday 20 October");
    expect(text).toContain("Wednesday 21 October");
    expect(text).not.toMatch(/Saturday 18|Monday 20|Tuesday 21/);
    // The rules' own date for keeping the video up, not a vaguer one.
    expect(entry().text).toContain("Keep the video public and tagged until Saturday 24 October.");
  });

  it("tell a winner how to claim, with no link that signs anyone in", () => {
    const mail = rovvWinnerEmail({ to: "a@example.test", fullName: "Ada Obi", tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD" });
    expect(mail.subject).toBe("You won a Blockfest ticket with ROVV");
    expect(mail.text).toMatch(/Reply to this email by 6:00 PM on Wednesday 21 October/);
    expect(mail.html).not.toMatch(/\?t=|\/enter\b/);
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
