/**
 * The doors a returning creator can see.
 *
 * The flow audit found registering reachable three ways and coming BACK
 * reachable none: the only visible door was "Lost your link?", which
 * rotates the access token and kills the link in the welcome email the
 * creator was told three times to keep. These pin the doors that were
 * added, and the order they appear in.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("re-entry", () => {
  it("the hero offers a way back for somebody already registered", () => {
    const hero = read("components/campaigns/monica-hero.tsx");
    expect(hero).toContain("monicaRoutes.me");
    expect(hero).toMatch(/Already registered/i);
  });

  it("the landing footer puts the page before recovery", () => {
    // Order matters: recovery rotates the token, so it must not be the
    // first thing a returning creator reaches for.
    const page = read("app/campaigns/monica-money-story/page.tsx");
    expect(page.indexOf("monicaRoutes.me")).toBeGreaterThan(-1);
    expect(page.indexOf("monicaRoutes.me")).toBeLessThan(
      page.indexOf("monicaRoutes.recover"),
    );
  });

  it("the leaderboard offers more than joining to people already on it", () => {
    const board = read("app/campaigns/monica-money-story/leaderboard/page.tsx");
    expect(board).toContain("monicaRoutes.me");
  });
});

describe("the success screen tells the truth", () => {
  const form = read("components/campaigns/registration-form.tsx");

  it("no longer claims the link cannot be sent again", () => {
    // It is emailed a few lines later in the route, and recovery mails a
    // fresh one. Saying otherwise next to an inbox that already has it
    // teaches people the product does not know itself.
    expect(form).not.toMatch(/cannot send it to you again/i);
  });

  it("says the link is in their inbox, and names recovery as the way back", () => {
    expect(form).toMatch(/emailed it to you/i);
    expect(form).toContain("monicaRoutes.recover");
  });
});

describe("the paste point names the account rule", () => {
  it("the form can print the registered handle for the chosen platform", () => {
    const sub = read("components/campaigns/submission-form.tsx");
    expect(sub).toMatch(/It has to be a post from @/);
    // The platform the form will send, not the raw select state, which can
    // still name a platform that has left the list.
    expect(sub).toContain("handles?.[selected]");
  });

  it("the page hands it the handles it already loaded", () => {
    const me = read("app/campaigns/monica-money-story/me/page.tsx");
    expect(me).toMatch(/handles=\{Object\.fromEntries/);
  });
});
