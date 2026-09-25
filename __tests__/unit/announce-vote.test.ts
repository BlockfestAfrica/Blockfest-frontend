import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { voteLiveEmail } from "@/lib/email/templates";

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const route = codeOnly(
  readFileSync(join(process.cwd(), "app/api/admin/announce-vote/route.ts"), "utf8"),
);

describe("the vote-is-open email", () => {
  const mail = (over = {}) =>
    voteLiveEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      weekNo: 1,
      nominees: ["Ada Nwosu", "Bola Ade", "Chidi Eze"],
      closesAtLagos: "Sunday, 27 September, 6:00 pm",
      votingUrl: "https://blockfestafrica.com/campaigns/monica-money-story/winners#shortlist",
      ...over,
    });

  it("names the nominees, not just the fact of a vote", () => {
    // "A vote is open" is a notification. "Ada, Bola and Chidi are on the
    // ballot" is a reason to open it.
    const m = mail();
    expect(m.text).toContain("Ada Nwosu, Bola Ade and Chidi Eze");
    expect(m.text).toContain("Sunday, 27 September, 6:00 pm");
  });

  it("reads correctly with a single nominee", () => {
    expect(mail({ nominees: ["Ada Nwosu"] }).text).toContain("Ada Nwosu are on the week 1 ballot");
  });

  it("tells a non-nominee they can vote and share", () => {
    // Most recipients are not on the ballot, and turnout is the whole point.
    expect(mail().text).toMatch(/whether or not you are on the ballot/i);
  });

  it("carries the public link", () => {
    expect(mail().text).toContain("#shortlist");
  });
});

describe("the announce-vote route", () => {
  it("refuses a round that is not open yet", () => {
    // A round staged for tomorrow is a page that refuses every ballot, and
    // this announcement can only be spent once.
    expect(route).toContain('status !== "open"');
    expect(route).toContain("opens_at");
    expect(route).toMatch(/Voting has not started yet/);
  });

  it("is once per round, with the audit row as the ledger", () => {
    expect(route).toContain("'vote.announced'");
    expect(route).toMatch(/already\.rows\?\.length/);
  });

  it("claims the ledger before the first send, not after the last", () => {
    // Written the other way it is a report, not a lock: a batch that
    // outruns maxDuration leaves no row and a retry re-mails everybody.
    const claim = route.indexOf("INSERT INTO audit_log");
    const loop = route.indexOf("for (let i = 0");
    expect(claim).toBeGreaterThan(-1);
    expect(loop).toBeGreaterThan(-1);
    expect(claim, "ledger claimed first").toBeLessThan(loop);
  });

  it("paces the batch so the run fits the function budget", () => {
    // One at a time against a slow provider runs out 300 seconds at about
    // three hundred creators, and truncates silently.
    expect(route).toContain("maxDuration = 300");
    expect(route).toContain("const BATCH = 4");
  });

  it("is owner-only and mails active creators only", () => {
    expect(route).toContain("isOwner");
    expect(route).toMatch(/COALESCE\(cc\.status, 'active'\) = 'active'/);
  });
});
