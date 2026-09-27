import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartnerData } from "@/lib/partners-2026";
import type { Speaker } from "@/lib/speakers";

/*
 * The home page's partners and speakers, and the speakers page.
 *
 * The owner's ask: the partner tiers need a visible hierarchy (headline,
 * silver and mobility were near-identical boxes), the lineup loses its Pause
 * button, and both speaker screens get tidied. These render the components
 * and pin each of those.
 */

const data = vi.hoisted(() => ({ partners: { headline: [] } as PartnerData }));

vi.mock("@/lib/partners-2026", () => ({
  get partners() {
    return data.partners;
  },
}));
vi.mock("@/lib/hooks/use-subtle-animations", () => ({ useSubtleAnimations: () => {} }));
vi.mock("@/components/carousel", () => ({
  default: ({ speakers }: { speakers: Speaker[] }) => (
    <div data-testid="carousel">{speakers.map((s) => s.name).join(", ")}</div>
  ),
}));

const { PartnersSection2026 } = await import("@/components/home/partners-2026");
const { SpeakersSection } = await import("@/components/home/speakers");
const { FeaturedSpeakersGrid } = await import("@/components/speakers/2026-speakers-grid");

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

const logo = (name: string) => ({
  name,
  logo: `/2026/sponsors/${name.toLowerCase()}.png`,
  twitter: `https://x.com/${name.toLowerCase()}`,
});

beforeEach(() => {
  data.partners = { headline: [] };
});

/** The sm: height of the plate holding a logo, the tier's size on a laptop. */
function plateHeight(name: string) {
  const plate = screen.getByAltText(name).parentElement!;
  const match = plate.className.match(/sm:h-(\d+)/);
  expect(match, `${name} plate has a height`).toBeTruthy();
  return Number(match![1]);
}

describe("2026 partners", () => {
  it("draws every tier a step smaller than the one above it", () => {
    data.partners = {
      headline: [logo("Monica")],
      gold: [logo("Goldco")],
      silver: [logo("Cake")],
      bronze: [logo("Bronzeco")],
      official: [{ ...logo("Rovv"), role: "Mobility" }],
    };
    render(<PartnersSection2026 />);
    const heights = ["Monica", "Goldco", "Cake", "Bronzeco", "Rovv"].map(plateHeight);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i], `tier ${i} is smaller than tier ${i - 1}`).toBeLessThan(heights[i - 1]);
    }
    expect(screen.getByAltText("Monica").parentElement!.className).toMatch(/ring-brand-gold/);
  });

  it("names each tier, in order, and leaves out the empty ones", () => {
    data.partners = {
      headline: [logo("Monica")],
      silver: [logo("Cake"), logo("Other")],
      official: [{ ...logo("Rovv"), role: "Mobility" }],
    };
    render(<PartnersSection2026 />);
    const tiers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(tiers).toEqual(["Headline Sponsor", "Silver Sponsors", "Mobility Sponsor"]);
  });

  it("labels a lone category sponsor by its part, and several under one heading with their parts", () => {
    data.partners = { headline: [logo("Monica")], official: [{ ...logo("Rovv"), role: "Mobility" }] };
    const { unmount } = render(<PartnersSection2026 />);
    expect(screen.getByRole("heading", { name: "Mobility Sponsor" })).toBeTruthy();
    unmount();

    data.partners = {
      headline: [logo("Monica")],
      official: [
        { ...logo("Rovv"), role: "Mobility" },
        { ...logo("Wally"), role: "Wallet" },
      ],
    };
    render(<PartnersSection2026 />);
    expect(screen.getByRole("heading", { name: "Official Sponsors" })).toBeTruthy();
    expect(within(screen.getByAltText("Rovv").closest("li")!).getByText("Mobility")).toBeTruthy();
    expect(within(screen.getByAltText("Wally").closest("li")!).getByText("Wallet")).toBeTruthy();
  });

  it("gives every logo its partner's name, and every link a name that says where it goes", () => {
    data.partners = { headline: [logo("Monica")], silver: [logo("Cake")] };
    render(<PartnersSection2026 />);
    expect(screen.getByRole("link", { name: "Monica on X (opens in a new tab)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cake on X (opens in a new tab)" })).toBeTruthy();
    expect(screen.queryByAltText(/sponsor logo/i)).toBeNull();
  });

  it("the real partner list names everyone and points at logos that exist", async () => {
    const real = await vi.importActual<typeof import("@/lib/partners-2026")>("@/lib/partners-2026");
    const everyone = [
      ...real.partners.headline,
      ...(real.partners.gold ?? []),
      ...(real.partners.silver ?? []),
      ...(real.partners.bronze ?? []),
      ...(real.partners.official ?? []),
      ...(real.partners.community ?? []),
      ...(real.partners.media ?? []),
      ...(real.partners.ecosystem ?? []),
    ];
    expect(everyone.length).toBeGreaterThan(0);
    for (const partner of everyone) {
      expect(partner.name.trim(), partner.logo).not.toBe("");
      expect(existsSync(join(process.cwd(), "public", partner.logo)), partner.logo).toBe(true);
    }
  });
});

describe("the home page lineup", () => {
  it("has no Pause button, because the carousel no longer moves by itself", () => {
    const carousel = codeOnly(read("components/carousel.tsx"));
    expect(carousel).not.toMatch(/embla-carousel-autoplay|Autoplay\(/);
    expect(carousel).not.toMatch(/"Pause"|>\s*Pause|toggleAutoplay/);
  });

  it("names the full lineup, and asks one thing at a time", () => {
    render(<SpeakersSection />);
    expect(screen.getByRole("link", { name: /See the full lineup/ }).getAttribute("href")).toBe("/speakers");

    const apply = screen.getByRole("link", { name: "Apply to Speak" });
    const past = screen.getByRole("link", { name: "See Past Speakers" });
    expect(apply.getAttribute("href")).toBe("/call-for-speakers");
    expect(apply.className).toMatch(/bg-brand-gold/);
    // The archive is the aside, not a second primary.
    expect(past.className).not.toMatch(/bg-brand-gold/);
  });

  it("offers Apply only while the call for speakers is open", () => {
    const src = codeOnly(read("components/home/speakers.tsx"));
    expect(src).toMatch(/isSpeakerFormOpen && \(/);
  });
});

const speaker = (over: Partial<Speaker> & Pick<Speaker, "name" | "title">): Speaker => ({
  image: "/images/speakers/placeholder.jpg",
  cohort: "2026",
  expertise: ["Fintech"],
  ...over,
});

describe("the speakers page", () => {
  it("does not print the company twice", () => {
    render(
      <FeaturedSpeakersGrid
        speakers={[
          speaker({ name: "Ashley", title: "Co-Founder & CEO, Owego", company: "Owego" }),
          speaker({ name: "Opeyemi", title: "QA Manager, Solana Developer Platform", company: "Solana Foundation" }),
          speaker({ name: "Ola", title: "Strategist" }),
        ]}
      />,
    );
    expect(screen.getByText("Co-Founder & CEO")).toBeTruthy();
    expect(screen.queryByText("Co-Founder & CEO, Owego")).toBeNull();
    // A different organisation in the title is information, not repetition.
    expect(screen.getByText("QA Manager, Solana Developer Platform")).toBeTruthy();
    expect(screen.getByText("Strategist")).toBeTruthy();
  });

  it("keeps the filters to one sideways row on a phone", () => {
    render(
      <FeaturedSpeakersGrid
        speakers={[
          speaker({ name: "A", title: "T", expertise: ["Fintech", "Education"] }),
          speaker({ name: "B", title: "T", expertise: ["Development"] }),
        ]}
      />,
    );
    const filters = screen.getByRole("group", { name: "Filter speakers by expertise" });
    expect(filters.className).toMatch(/overflow-x-auto/);
    expect(filters.className).toMatch(/sm:flex-wrap/);
    for (const chip of within(filters).getAllByRole("button")) {
      expect(chip.className).toMatch(/shrink-0/);
    }
  });

  it("stops telling search results and link previews the lineup is coming soon once it is out", () => {
    const page = codeOnly(read("app/speakers/page.tsx"));
    expect(page).toMatch(/const announced = SpeakersList\.some\(is2026Speaker\)/);
    // The "Coming Soon" wording only survives as the not-yet-announced branch.
    expect(page).toMatch(/announced\s*\?\s*"Blockfest Africa Speakers - The 2026 Lineup"/);
    expect(page).toMatch(/title: shareTitle/);
    expect(page).not.toMatch(/Browse previous editions of past\s+speakers/);
  });
});
