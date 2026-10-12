/**
 * The short and mistyped addresses that reach ROVV's campaign: /rovv for
 * posts, and the TikTok bio link as it was set on 12 October
 * (/campaignsCampaignlink), which otherwise answers 404. Read from the real
 * next.config, so the test is of what Next is actually given.
 *
 * Next matches redirect sources without regard to case (caseSensitiveRoutes
 * is false), so no rule may match the campaign's own address in any case:
 * that would send the page to itself for ever.
 */
import { describe, expect, it } from "vitest";
import config from "../../next.config";

const rules = async () => (await config.redirects?.()) ?? [];

describe("addresses that lead to the ROVV campaign", () => {
  it.each(["/rovv", "/campaignsCampaignlink"])("%s goes to /campaigns/rovv, not for good", async (source) => {
    expect((await rules()).find((r) => r.source === source)).toMatchObject({
      destination: "/campaigns/rovv",
      permanent: false,
    });
  });

  it("never catches the campaign's own addresses, in any case, so nothing loops", async () => {
    const own = ["/campaigns/rovv", "/campaigns/rovv/rules", "/campaigns/rovv/privacy"];
    for (const rule of await rules()) {
      for (const path of own) {
        expect(rule.source.toLowerCase(), `${rule.source} would catch ${path}`).not.toBe(path);
      }
    }
  });
});
