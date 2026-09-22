import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminActivityEmail } from "@/lib/email/templates";

/*
 * The notification the team gets when a creator registers or submits.
 *
 * Two properties matter more than the wording. It must carry no creator
 * contact details, because internal mail on a domain whose SPF does not yet
 * authorise the sender is a plausible spam-folder or wrong-inbox candidate.
 * And the recipient query must never reach for the credential column.
 */

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("the admin activity notice", () => {
  const submission = () =>
    adminActivityEmail({
      to: "owner@blockfestafrica.com",
      kind: "submission",
      who: "Amara Obi",
      platformLabel: "TikTok",
      waiting: 9,
      consoleUrl: "https://blockfestafrica.com/admin",
    });

  const registration = () =>
    adminActivityEmail({
      to: "owner@blockfestafrica.com",
      kind: "registration",
      who: "Amara Obi",
      consoleUrl: "https://blockfestafrica.com/admin",
    });

  it("names who did what, which is the point of asking for it", () => {
    expect(submission().subject).toContain("Amara Obi");
    expect(submission().subject).toContain("TikTok");
    expect(registration().subject).toContain("Amara Obi");
  });

  it("tells a reviewer how much work is waiting", () => {
    expect(submission().text).toContain("9 entries are waiting");
  });

  it("does not call a registration review work, because it is not", () => {
    expect(registration().text).not.toMatch(/waiting for review/i);
  });

  it("reports a burst rather than hiding it", () => {
    const m = adminActivityEmail({
      to: "owner@blockfestafrica.com",
      kind: "submission",
      who: "Amara Obi",
      platformLabel: "X",
      waiting: 80,
      alsoSince: 23,
      consoleUrl: "https://blockfestafrica.com/admin",
    });
    expect(m.text).toContain("23 more");
  });

  it("carries no creator email or phone number", () => {
    // An internal alert that bounces into the wrong inbox must not be a
    // leak, and this domain's mail authentication is not yet fixed.
    for (const m of [submission(), registration()]) {
      expect(m.text).not.toMatch(/@example\.com|@gmail\.com|\+234/);
      expect(m.html).not.toMatch(/@example\.com|@gmail\.com|\+234/);
    }
  });

  it("never selects the credential column when finding recipients", () => {
    const source = codeOnly(
      readFileSync(join(process.cwd(), "lib/admin/recipients.ts"), "utf8"),
    );
    expect(source).not.toMatch(/password_hash/);
    expect(source).not.toMatch(/SELECT\s+\*/i);
  });

  it("is off unless switched on, so it can be stopped without a deploy", () => {
    const source = codeOnly(
      readFileSync(join(process.cwd(), "lib/notify/admin-activity.ts"), "utf8"),
    );
    expect(source).toContain("ADMIN_ACTIVITY_ALERTS");
    // Fails closed: the strict throttle is the one written to guard a mailer.
    expect(source).toContain("allowKeyStrict");
    expect(source).not.toMatch(/\ballowKey\(/);
  });
});
