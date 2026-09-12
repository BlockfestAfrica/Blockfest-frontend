/**
 * The site privacy policy, checked against the site.
 *
 * A policy makes factual claims about code, and code changes without anybody
 * rereading the policy. These assertions cover the claims that would become
 * false silently rather than loudly.
 *
 * The one that matters most is the badge generator. The policy says a
 * photograph never leaves the browser, which is true today because that feature
 * contains no network call at all. Somebody adding an upload to it would make
 * the policy a false statement about personal data, and nothing else in the
 * codebase would notice.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  privacySections,
  privacySurfaces,
  PRIVACY_VERSION,
} from "@/lib/privacy";
import { CONTACT_EMAIL } from "@/lib/constants";

const allText = [
  ...privacySurfaces.flatMap((s) => [s.name, s.collects, s.destination]),
  ...privacySections.flatMap((s) => [s.title, ...s.paragraphs]),
].join(" ");

describe("claims the policy makes about the code", () => {
  it("is right that the badge generator never uploads a photograph", () => {
    // grep rather than an import, because the claim is about the whole feature
    // and not about one module's exports.
    let hits = "";
    try {
      hits = execSync(
        "grep -rEl 'fetch\\(|XMLHttpRequest|sendBeacon|FormData' app/getdp || true",
        { cwd: process.cwd(), encoding: "utf8" },
      ).trim();
    } catch {
      hits = "";
    }

    expect(
      hits,
      `app/getdp now contains a network call, so the privacy policy claim that the photograph never leaves the browser is no longer true:\n${hits}`,
    ).toBe("");

    const badge = privacySurfaces.find((s) => /badge/i.test(s.name));
    expect(badge).toBeTruthy();
    expect(badge!.destination).toMatch(/Nothing is uploaded/i);
  });

  it("is right that the campaign registration is the data we hold ourselves", () => {
    const registration = privacySurfaces.find((s) =>
      /campaign registration/i.test(s.name),
    );
    expect(registration?.heldByUs).toBe(true);
  });

  it("names the third parties it says handle things for us", () => {
    // If one of these is swapped out, the policy is naming a company that no
    // longer has anybody's data and omitting the one that does.
    const constants = readFileSync(
      join(process.cwd(), "lib/newsletter.ts"),
      "utf8",
    );
    expect(constants).toContain("substack");
    expect(allText).toMatch(/Substack/);

    const tickets = readFileSync(join(process.cwd(), "lib/tickets.ts"), "utf8");
    expect(tickets).toContain("meetumo");
    expect(allText).toMatch(/Meetumo/);
  });

  it("does not claim to hold what a provider holds", () => {
    const newsletter = privacySurfaces.find((s) => /newsletter/i.test(s.name));
    expect(newsletter?.heldByUs).toBe(false);
    const tickets = privacySurfaces.find((s) => /tickets/i.test(s.name));
    expect(tickets?.heldByUs).toBe(false);
  });
});

describe("what the NDPA requires", () => {
  it("names the controller", () => {
    expect(allText).toMatch(/Tevah Synergy/);
  });

  it("gives an address to write to", () => {
    expect(allText).toContain(CONTACT_EMAIL);
  });

  it("states retention as a period, not as forever", () => {
    expect(allText).not.toMatch(/indefinitely|forever/i);
    expect(allText).toMatch(/\d+ months/);
  });

  it("says where to complain", () => {
    expect(allText).toMatch(/Nigeria Data Protection Commission/);
  });

  it("is versioned", () => {
    expect(PRIVACY_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe("house style", () => {
  it("uses no em dashes", () => {
    expect(allText).not.toContain("—");
  });
});
