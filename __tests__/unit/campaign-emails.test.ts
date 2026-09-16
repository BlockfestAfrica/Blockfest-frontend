/**
 * The launch-day email additions: receipts, notices, and their properties.
 *
 * Wording is not what these tests hold. What they hold is escaping (every
 * string here arrives from a text input or from another creator's name),
 * and one property that is security rather than style: the vote receipt
 * must be incapable of distinguishing a counted vote from a held one,
 * because its whole safety argument is that the template takes no status
 * and its words never vary by one.
 */

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  awardEmail,
  handleFixAckEmail,
  nomineeResultEmail,
  repriceEmail,
  shortlistEmail,
  submissionReceivedEmail,
  referralCreditEmail,
  voteReceiptEmail,
  votingPage,
  withdrawnEmail,
} from "@/lib/email/templates";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("the vote receipt", () => {
  it("cannot leak vote status, because it never knew it", () => {
    const mail = voteReceiptEmail({
      to: "voter@gmail.com",
      nomineeName: "Amara Obi",
      weekNo: 2,
    });

    // The template's parameters are the whole channel. If a status word
    // ever appears here, someone has widened the channel; this is the
    // tripwire.
    const everything = `${mail.subject} ${mail.text} ${mail.html}`.toLowerCase();
    for (const forbidden of [
      "held",
      "hold",
      "review",
      "counted",
      "fraud",
      "pending",
      "flag",
      "suspicious",
      "verify",
      "check",
    ]) {
      expect(everything).not.toContain(forbidden);
    }
  });

  it("names who the vote was for and where results land", () => {
    const mail = voteReceiptEmail({
      to: "voter@gmail.com",
      nomineeName: "Amara Obi",
      weekNo: 2,
    });
    expect(mail.text).toContain("Amara Obi");
    expect(mail.text).toContain("week 2");
    expect(mail.text).toContain(votingPage());
  });

  it("escapes a nominee name that carries markup", () => {
    const mail = voteReceiptEmail({
      to: "voter@gmail.com",
      nomineeName: "<b>Bold</b> & Co",
      weekNo: 1,
    });
    expect(mail.html).not.toContain("<b>Bold</b>");
    expect(mail.html).toContain("&lt;b&gt;");
  });
});

describe("the shortlist notice", () => {
  it("carries the closing moment and the public voting page", () => {
    const mail = shortlistEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      weekNo: 1,
      closesAtLagos: "Sunday, 20 September, 6:00 pm",
      votingUrl: votingPage(),
    });
    expect(mail.subject).toContain("week 1 ballot");
    expect(mail.text).toContain("Sunday, 20 September, 6:00 pm");
    expect(mail.text).toContain(votingPage());
    expect(mail.html).toContain("Sunday, 20 September, 6:00 pm");
  });
});

describe("the manual award notice", () => {
  it("reads as a gain when points are positive", () => {
    const mail = awardEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      sourceLabel: "Featured by Blockfest Africa",
      points: 50,
      note: "Your thread was featured on the Blockfest account.",
      pointsTotal: 350,
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.subject).toBe("+50 points: Featured by Blockfest Africa");
    expect(mail.text).toContain("350");
  });

  it("reads as an adjustment when points are negative, and keeps the note", () => {
    const mail = awardEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      sourceLabel: "Adjustment",
      points: -40,
      note: "Duplicate engagement bonus, reversed.",
      pointsTotal: 310,
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.subject).toContain("adjusted");
    expect(mail.text).toContain("-40");
    expect(mail.text).toContain("Duplicate engagement bonus, reversed.");
  });

  it("escapes an admin note that carries markup", () => {
    const mail = awardEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      sourceLabel: "Quality bonus",
      points: 50,
      note: `<img src=x onerror=alert(1)>`,
      pointsTotal: 200,
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img");
  });
});

describe("the submission receipt", () => {
  it("echoes exactly what was submitted, so a wrong paste is caught now", () => {
    const mail = submissionReceivedEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      weekNo: 3,
      platformLabel: "TikTok",
      url: "https://www.tiktok.com/@amara/video/123",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.subject).toContain("week 3");
    expect(mail.text).toContain("https://www.tiktok.com/@amara/video/123");
    expect(mail.text).toContain("either way");
  });
});

describe("the reprice notice", () => {
  it("states both numbers and the reason", () => {
    const mail = repriceEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      weekNo: 2,
      before: 150,
      after: 200,
      reason: "The platform bonus rate was corrected.",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.text).toContain("150");
    expect(mail.text).toContain("200");
    expect(mail.text).toContain("The platform bonus rate was corrected.");
  });
});

describe("the handle request receipt", () => {
  it("names both handles and says to hold that platform's entry", () => {
    const mail = handleFixAckEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      platformLabel: "X (Twitter)",
      oldHandle: "amaraobi",
      requestedHandle: "amara_obi",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(mail.text).toContain("@amaraobi");
    expect(mail.text).toContain("@amara_obi");
    expect(mail.text.toLowerCase()).toContain("hold");
  });
});

describe("the nominee result notice", () => {
  it("names the winner and escapes them in the html", () => {
    const mail = nomineeResultEmail({
      to: "creator@example.com",
      fullName: "Ben Ade",
      weekNo: 1,
      winnerName: "Amara & Friends",
      votingUrl: votingPage(),
    });
    expect(mail.text).toContain("Amara & Friends");
    expect(mail.html).toContain("Amara &amp; Friends");
    expect(mail.html).not.toContain("&amp;amp;");
  });
});

describe("the public voting page link", () => {
  it("lands on the winners page shortlist anchor", () => {
    expect(votingPage()).toBe(
      "https://blockfestafrica.com/campaigns/monica-money-story/winners#shortlist",
    );
  });
});

describe("the withdrawal notice", () => {
  const mail = (over = {}) =>
    withdrawnEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      platformLabel: "TikTok",
      weekNo: 2,
      url: "https://www.tiktok.com/@amara/video/123",
      closesAtLagos: "Saturday, 3 October, 12:00 pm",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
      recoverUrl: "https://blockfestafrica.com/campaigns/monica-money-story/recover",
      ...over,
    });

  it("names the deadline for the replacement, which is the point of it", () => {
    const m = mail();
    expect(m.text).toContain("Saturday, 3 October, 12:00 pm");
    expect(m.text).toContain("https://www.tiktok.com/@amara/video/123");
  });

  it("does not promise a replacement when no week is open", () => {
    // Withdrawing after the window closed cannot be undone, and telling
    // somebody to send the right one is the exact advice-you-cannot-follow
    // bug this whole feature exists to fix.
    const m = mail({ closesAtLagos: null });
    expect(m.text).toMatch(/cannot be replaced/i);
    expect(m.text).not.toMatch(/before Saturday/i);
  });

  it("carries the not-me path, because a thief can withdraw too", () => {
    expect(mail().text).toMatch(/somebody else has your personal link/i);
    expect(mail().text).toContain("/recover");
  });
});

describe("the referral credit notice", () => {
  const mail = (over = {}) =>
    referralCreditEmail({
      to: "referrer@example.com",
      fullName: "Amara Obi",
      referredName: "Chidi Nwosu",
      points: 50,
      pointsTotal: 310,
      referralCode: "AMARA7K",
      personalPage: "https://blockfestafrica.com/campaigns/monica-money-story/me",
      ...over,
    });

  it("names the person, not just the payout", () => {
    // "A referral was credited" is a receipt. "Chidi's entry was approved"
    // is a reason to send the code to somebody else.
    const m = mail();
    expect(m.subject).toContain("Chidi");
    expect(m.text).toContain("Chidi");
    expect(m.text).toContain("50");
    expect(m.text).toContain("310");
  });

  it("states the rule that makes the timing make sense", () => {
    // Creators ask why a signup paid nothing. The rule is on approval,
    // and the mail is the only place they will read it.
    expect(mail().text).toMatch(/first approved entry, not on a signup/i);
  });

  it("carries the code so the next share needs no hunting", () => {
    expect(mail().text).toContain("AMARA7K");
    expect(mail().html).toContain("AMARA7K");
  });
});
