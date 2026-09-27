import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SpeakersList,
  is2026Speaker,
  isPastSpeaker,
  speakerBySlug,
  speakerProfiles,
  speakerShortName,
  speakerSlug,
} from "@/lib/speakers";

/*
 * A speaker can return. Hon. Mobolaji Ogunlende Abubakre spoke at a previous
 * edition and is in the 2026 lineup, so he has an entry in each, sharing a
 * portrait and a name, and so a profile URL. These pin that he shows in both
 * lists, that the shared URL is one page showing the current entry, and that
 * a repeated name only ever means exactly that.
 */

const RETURNING = "Hon. Mobolaji Ogunlende Abubakre";

describe("a returning speaker", () => {
  it("is in this year's lineup and still in the archive, with the same portrait", () => {
    const current = SpeakersList.filter(is2026Speaker).filter((s) => s.name === RETURNING);
    const past = SpeakersList.filter(isPastSpeaker).filter((s) => s.name === RETURNING);
    expect(current).toHaveLength(1);
    expect(past).toHaveLength(1);
    expect(current[0].image).toBe(past[0].image);
  });

  it("joins the lineup in announcement order, after the names already out", () => {
    const lineup = SpeakersList.filter(is2026Speaker).map((s) => s.name);
    expect(lineup[lineup.length - 1]).toBe(RETURNING);
    expect(lineup[0]).toBe("Dr. Tunji Alausa");
  });

  it("has one profile, and it is the 2026 one", () => {
    const profile = speakerBySlug(speakerSlug(RETURNING));
    expect(profile?.cohort).toBe("2026");
  });
});

describe("profiles", () => {
  it("are one per person, so the profile pages never collide", () => {
    const slugs = speakerProfiles().map((s) => speakerSlug(s.name));
    expect(new Set(slugs).size).toBe(slugs.length);
    // Everybody in the list has a profile.
    for (const speaker of SpeakersList) {
      expect(speakerBySlug(speakerSlug(speaker.name)), speaker.name).toBeTruthy();
    }
  });

  it("only share a name when it is one past entry and one 2026 entry", () => {
    const bySlug = new Map<string, typeof SpeakersList>();
    for (const speaker of SpeakersList) {
      const slug = speakerSlug(speaker.name);
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), speaker]);
    }
    for (const [slug, entries] of bySlug) {
      if (entries.length === 1) continue;
      expect(entries, `${slug} is listed ${entries.length} times`).toHaveLength(2);
      expect(entries.filter(is2026Speaker), `${slug} needs exactly one 2026 entry`).toHaveLength(1);
      expect(entries.filter(isPastSpeaker), `${slug} needs exactly one past entry`).toHaveLength(1);
    }
  });

  it("point at portraits that exist", () => {
    for (const speaker of SpeakersList) {
      expect(existsSync(join(process.cwd(), "public", speaker.image)), `${speaker.name}: ${speaker.image}`).toBe(true);
    }
  });
});

describe("how a profile refers to its speaker", () => {
  it("names somebody with an honorific in full, never by the honorific alone", () => {
    expect(speakerShortName(RETURNING)).toBe(RETURNING);
    expect(speakerShortName("Dr. Tunji Alausa")).toBe("Dr. Tunji Alausa");
    expect(speakerShortName("Rt. Hon. Somebody")).toBe("Rt. Hon. Somebody");
    expect(speakerShortName("Prof Ada Obi")).toBe("Prof Ada Obi");
  });

  it("uses a first name otherwise", () => {
    expect(speakerShortName("Teddi Speaks")).toBe("Teddi");
    expect(speakerShortName("  Eniola Osiyoku ")).toBe("Eniola");
  });

  it("is what the profile page uses, in every sentence", () => {
    const page = readFileSync(join(process.cwd(), "app/speakers/[slug]/page.tsx"), "utf8");
    expect(page).not.toMatch(/speaker\.name\.split\(" "\)\[0\]/);
    expect(page.match(/speakerShortName\(speaker\.name\)/g)?.length).toBe(3);
  });
});
