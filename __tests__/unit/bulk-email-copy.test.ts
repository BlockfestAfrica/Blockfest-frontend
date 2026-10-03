/**
 * The owner's copy of every bulk email.
 *
 * He sends announcements and reminders to every creator and never saw what
 * they received. He asked to be copied on bulk sends, only him and not every
 * admin. One copy per send, to the address in BULK_EMAIL_COPY_TO, never one
 * per recipient, and never an address in the code (the repository is public).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const quiet = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/email/client", () => ({ sendEmailQuietly: quiet, sendEmail: vi.fn() }));

const { bulkCopyRecipients, sendBulkCopy } = await import("@/lib/email/copy");
const templates = await import("@/lib/email/templates");

const sample = { to: "ada@e.com", toName: "Ada Obi", subject: "Stage 2 closes today at 12:00", html: "<p>x</p>", text: "x" };

beforeEach(() => quiet.mockClear());
afterEach(() => {
  delete process.env.BULK_EMAIL_COPY_TO;
});

describe("who gets the copy", () => {
  it("is whoever BULK_EMAIL_COPY_TO names, and nobody when it is unset", async () => {
    expect(bulkCopyRecipients()).toEqual([]);
    await sendBulkCopy(sample, 87, "test");
    expect(quiet).not.toHaveBeenCalled();
  });

  it("takes a comma separated list and drops anything that is not an address", () => {
    process.env.BULK_EMAIL_COPY_TO = " owner@example.test , not-an-address,second@example.test ";
    expect(bulkCopyRecipients()).toEqual(["owner@example.test", "second@example.test"]);
  });

  it("is not written into the code: no address literal in the copy helper", () => {
    const src = readFileSync(join(process.cwd(), "lib/email/copy.ts"), "utf8");
    expect(src).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});

describe("the copy", () => {
  it("is one email, exactly as sent, readdressed, with the subject saying how many it went to", async () => {
    process.env.BULK_EMAIL_COPY_TO = "owner@example.test";
    await sendBulkCopy(sample, 87, "deadline reminder");
    expect(quiet).toHaveBeenCalledTimes(1);
    const [copy, context] = quiet.mock.calls[0] as unknown as [typeof sample, string];
    expect(copy.to).toBe("owner@example.test");
    expect(copy.toName).toBeUndefined();
    expect(copy.subject).toBe("[Copy · sent to 87] Stage 2 closes today at 12:00");
    expect(copy.html).toBe(sample.html);
    expect(context).toBe("deadline reminder copy");
  });

  it("is not sent when nothing was", async () => {
    process.env.BULK_EMAIL_COPY_TO = "owner@example.test";
    await sendBulkCopy(null, 0, "x");
    await sendBulkCopy(sample, 0, "x");
    expect(quiet).not.toHaveBeenCalled();
  });
});

describe("what a copy can carry", () => {
  /* A copy hands its reader exactly what the first recipient got. Safe only
     because no bulk template carries a personal login link. */
  it("no bulk template carries a personal login link", () => {
    const base = { to: "ada@e.com", fullName: "Ada Obi", weekNo: 2 };
    const mails = [
      templates.challengeLiveEmail({ ...base, title: "T", question: null, brief: "B", basePoints: 100, closesAtLagos: "x", pageUrl: templates.personalPage() }),
      templates.deadlineReminderEmail({ ...base, title: "T", closesWhen: "today at 12:00", closesAtLagos: "x", pageUrl: templates.personalPage() }),
      templates.voteLiveEmail({ ...base, nominees: ["A", "B"], closesAtLagos: "x", votingUrl: templates.votingPage() }),
      templates.shortlistEmail({ ...base, closesAtLagos: "x", votingUrl: templates.votingPage() }),
      templates.nomineeResultEmail({ ...base, winnerName: "B", votingUrl: templates.votingPage() }),
      templates.resumedEmail({ to: "ada@e.com", fullName: "Ada Obi", closesAtLagos: "x", personalPage: templates.personalPage() }),
    ];
    const login = new URL(templates.personalLink("SECRET")).pathname;
    for (const mail of mails) {
      expect(mail.html + mail.text, mail.subject).not.toContain(login);
      expect(mail.html + mail.text, mail.subject).not.toMatch(/[?&]t=/);
    }
  });

  it("every bulk send copies the owner", () => {
    for (const route of [
      "app/api/admin/announce-challenge/route.ts",
      "app/api/admin/remind-challenge/route.ts",
      "app/api/admin/announce-vote/route.ts",
      "app/api/admin/vote-round/route.ts",
      "app/api/admin/winners/route.ts",
      "app/api/admin/pause/route.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), route), "utf8"), route).toMatch(/await sendBulkCopy\(/);
    }
  });
});
