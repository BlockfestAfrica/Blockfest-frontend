/**
 * Rovv's entry form, as the browser and the server both read it: which TikTok
 * links are a video, how a username, an email and a referral code are tidied,
 * and the one cross-check, that a full link names the account entering it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readTikTokLink, ROVV, rovvEntrySchema, rovvOpen, tiktokAuthor } from "@/lib/rovv";

const ok = (raw: string) => {
  const r = readTikTokLink(raw);
  if ("error" in r) throw new Error(`refused ${raw}: ${r.error}`);
  return r.url;
};
const refused = (raw: string) => "error" in readTikTokLink(raw);

describe("a TikTok link", () => {
  it("takes a full video link, tidied to one spelling", () => {
    const want = "https://tiktok.com/@ada.obi/video/7300000000000000001";
    expect(ok("https://www.tiktok.com/@ada.obi/video/7300000000000000001?is_from_webapp=1&sender_device=pc")).toBe(want);
    expect(ok("  https://tiktok.com/@ada.obi/video/7300000000000000001/  ")).toBe(want);
    expect(ok("https://m.tiktok.com/@ada.obi/video/7300000000000000001")).toBe(want);
  });

  it("takes the short links the app's Copy link gives", () => {
    expect(ok("https://vm.tiktok.com/ZMabc123/")).toBe("https://vm.tiktok.com/ZMabc123");
    expect(ok("https://vt.tiktok.com/ZSqxCpWFD")).toBe("https://vt.tiktok.com/ZSqxCpWFD");
    expect(ok("https://www.tiktok.com/t/ZTRabc12/")).toBe("https://tiktok.com/t/ZTRabc12");
  });

  it("refuses what is not one public video", () => {
    expect(refused("tiktok.com/@ada/video/7300000000000000001")).toBe(true);
    expect(refused("http://tiktok.com/@ada/video/7300000000000000001")).toBe(true);
    expect(refused("https://tiktok.com.evil.example/@ada/video/7300000000000000001")).toBe(true);
    expect(refused("https://instagram.com/reel/abc")).toBe(true);
    expect(refused("https://tiktok.com/@ada")).toBe(true);
    expect(refused("https://tiktok.com/music/some-sound-7300000000000000001")).toBe(true);
    expect(refused("https://vm.tiktok.com/")).toBe(true);
    expect(refused("https://vm.tiktok.com/a/b")).toBe(true);
  });

  it("names the author of a full link, and nobody for a short one", () => {
    expect(tiktokAuthor("https://tiktok.com/@Ada.Obi/video/7300000000000000001")).toBe("ada.obi");
    expect(tiktokAuthor("https://vt.tiktok.com/ZSqxCpWFD")).toBeNull();
  });
});

describe("the entry form", () => {
  const base = {
    fullName: "  Ada Obi ",
    email: " Ada.Obi+rovv@Gmail.com ",
    tiktokHandle: "@Ada.Obi",
    tiktokUrl: "https://www.tiktok.com/@ada.obi/video/7300000000000000001?lang=en",
    referralCode: " abc 123 ",
    acceptedRules: true as const,
    rulesVersion: "1.0",
    privacyVersion: "1.0",
  };

  it("tidies every field to what is stored", () => {
    const r = rovvEntrySchema.parse(base);
    expect(r).toMatchObject({
      fullName: "Ada Obi",
      email: "ada.obi+rovv@gmail.com",
      emailCanonical: "adaobi@gmail.com",
      tiktokHandle: "ada.obi",
      tiktokUrl: "https://tiktok.com/@ada.obi/video/7300000000000000001",
      referralCode: "ABC123",
      marketingOptIn: false,
    });
  });

  it("refuses a full link from another account, on the link", () => {
    const r = rovvEntrySchema.safeParse({ ...base, tiktokUrl: "https://tiktok.com/@someone/video/7300000000000000001" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["tiktokUrl"]);
    expect(r.error?.issues[0].message).toMatch(/@someone/);
  });

  it("takes a short link, whose author only a reviewer can see", () => {
    expect(rovvEntrySchema.safeParse({ ...base, tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD" }).success).toBe(true);
  });

  it("needs the box ticked, a username of TikTok's shape and a code", () => {
    const issue = (patch: object) => rovvEntrySchema.safeParse({ ...base, ...patch }).error?.issues[0].path[0];
    expect(issue({ acceptedRules: false })).toBe("acceptedRules");
    expect(issue({ tiktokHandle: "a" })).toBe("tiktokHandle");
    expect(issue({ tiktokHandle: "has space" })).toBe("tiktokHandle");
    expect(issue({ referralCode: "" })).toBe("referralCode");
    expect(issue({ referralCode: "no!" })).toBe("referralCode");
    expect(issue({ email: "not-an-email" })).toBe("email");
    expect(issue({ fullName: "A" })).toBe("fullName");
    expect(issue({ fullName: "Click https://example.test" })).toBe("fullName");
    expect(issue({ fullName: "Prize at www.example.test" })).toBe("fullName");
    expect(issue({ fullName: "Chiamaka O'Neil-Adeyemi" })).toBeUndefined();
  });
});

describe("the window", () => {
  it("opens at midnight on the 13th and closes at 23:59:59 on the 18th, Lagos", () => {
    expect(rovvOpen(new Date("2026-10-12T23:59:59+01:00"))).toBe(false);
    expect(rovvOpen(new Date("2026-10-13T00:00:00+01:00"))).toBe(true);
    expect(rovvOpen(new Date("2026-10-18T23:59:59+01:00"))).toBe(true);
    expect(rovvOpen(new Date("2026-10-19T00:00:00+01:00"))).toBe(false);
  });

  it("is the window the database enforces", () => {
    const sql = readFileSync(join(process.cwd(), "netlify/database/migrations/0073_rovv_campaign.sql"), "utf8");
    const toSql = (iso: string) => iso.replace("T", " ").replace(/:00$/, "").replace("+01:", "+01");
    expect(toSql(ROVV.opensAt)).toBe("2026-10-13 00:00:00+01");
    expect(sql).toContain(`'${toSql(ROVV.opensAt)}'`);
    expect(sql).toContain(`'${toSql(ROVV.closesAt)}'`);
  });
});
