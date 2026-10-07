/**
 * The 2026 speaker lineup's order and labels.
 *
 * The owner asked for the Deputy Governor of Lagos State to lead, as a
 * keynote speaker, for the Minister of Education to be shown as a speaker
 * rather than a special guest, and for the lineup to go one man, one woman,
 * knowing there are fewer women announced so far. Then (3 October) set the
 * first nine by hand; a fixed place is kept exactly and only the rest
 * alternate. Pronouns come from the team's own bios, never from a name.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  arrangeLineup,
  is2026Speaker,
  SpeakersList,
  type Speaker,
} from "@/lib/speakers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { FeaturedSpeakersGrid } = await import("@/components/speakers/2026-speakers-grid");

const person = (name: string, over: Partial<Speaker> = {}): Speaker => ({
  name,
  title: "Speaker",
  image: "/x.jpg",
  cohort: "2026",
  ...over,
});

const lineup = arrangeLineup(SpeakersList.filter(is2026Speaker));

describe("the 2026 lineup", () => {
  it("leads with the Deputy Governor, as a keynote speaker", () => {
    expect(lineup[0].name).toBe("Dr. Kadri Obafemi Hamzat");
    expect(lineup[0].role).toBe("keynote");
  });

  it("shows the Minister of Education as a speaker, not a special guest", () => {
    const minister = lineup.find((s) => s.name === "Dr. Tunji Alausa")!;
    expect(minister.role).toBe("speaker");
  });

  it("follows the order the team set, exactly, then everyone else", () => {
    expect(lineup.slice(0, 9).map((s) => s.name)).toEqual([
      "Dr. Kadri Obafemi Hamzat",
      "Teddi Speaks",
      "Prof. Temitayo Ogundipe",
      "Eniola Osiyoku",
      "Hon. Mobolaji Ogunlende Abubakre",
      "Opeyemi Stephen",
      "Faith Jerry",
      "Dr. Tunji Alausa",
      "Dára Sobaloju",
    ]);
    // Not in the team's list: after it, not dropped.
    expect(lineup.slice(9).map((s) => s.name).sort()).toEqual([
      "Ashley Rene Olika",
      "Ian Issa",
      "Olamilekan Majekodunmi",
      "Salemking",
      "Scott C. Eneje",
      "Uchenna Edeoga",
    ]);
  });

  it("records pronouns for every announced speaker, so the lineup can balance", () => {
    const missing = SpeakersList.filter(is2026Speaker)
      .filter((s) => !s.pronouns)
      .map((s) => s.name);
    expect(missing, "add pronouns as the speaker's bio states them").toEqual([]);
  });

  it("takes pronouns from what the bio says, and the two never disagree", () => {
    for (const s of SpeakersList.filter(is2026Speaker)) {
      const bio = (s.bio ?? "").toLowerCase();
      const he = /\b(he|his|him)\b/.test(bio);
      const she = /\b(she|her|hers)\b/.test(bio);
      if (he && !she) expect(s.pronouns, s.name).toBe("he");
      if (she && !he) expect(s.pronouns, s.name).toBe("she");
    }
  });
});

describe("arrangeLineup", () => {
  it("keeps fixed places first and exact, then alternates the rest by keynote, special guest, list order", () => {
    const list = [
      person("A", { pronouns: "he" }),
      person("B", { pronouns: "she" }),
      person("C", { pronouns: "he", role: "special-guest" }),
      person("D", { pronouns: "he", role: "keynote" }),
      person("E", { pronouns: "she", role: "special-guest" }),
      person("F", { pronouns: "he", order: 1 }),
    ];
    expect(arrangeLineup(list).map((s) => s.name)).toEqual(["F", "D", "E", "C", "B", "A"]);
  });

  it("keeps two fixed places side by side even when alternating would split them", () => {
    const list = [
      person("W", { pronouns: "she" }),
      person("M2", { pronouns: "he", order: 2 }),
      person("M1", { pronouns: "he", order: 1 }),
    ];
    expect(arrangeLineup(list).map((s) => s.name)).toEqual(["M1", "M2", "W"]);
  });

  it("starts with whoever leads overall, even a woman", () => {
    const list = [person("A", { pronouns: "he" }), person("B", { pronouns: "she", order: 1 })];
    expect(arrangeLineup(list).map((s) => s.name)).toEqual(["B", "A"]);
  });

  it("puts a speaker with no recorded pronouns last, rather than guessing", () => {
    const list = [person("X"), person("A", { pronouns: "he" }), person("B", { pronouns: "she" })];
    expect(arrangeLineup(list).map((s) => s.name)).toEqual(["A", "B", "X"]);
  });
});

describe("the /speakers grid", () => {
  it("wears Keynote Speaker on the keynote, Special Guest on special guests, and neither on the rest", () => {
    render(
      <FeaturedSpeakersGrid
        speakers={[
          person("Keynote Person", { pronouns: "he", role: "keynote", order: 1 }),
          person("Guest Person", { pronouns: "she", role: "special-guest" }),
          person("Plain Person", { pronouns: "he", role: "speaker" }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "View Keynote Person's profile (keynote speaker)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Guest Person's profile (special guest)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Plain Person's profile" })).toBeTruthy();
    expect(screen.getAllByText("Keynote Speaker")).toHaveLength(1);
    expect(screen.getAllByText("Special Guest")).toHaveLength(1);
  });
});
