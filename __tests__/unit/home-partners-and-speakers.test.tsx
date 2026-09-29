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

const data = vi.hoisted(() => ({
  partners: { headline: [] } as PartnerData,
  formOpen: true,
  announced: true,
}));

vi.mock("@/lib/partners-2026", () => ({
  get partners() {
    return data.partners;
  },
}));
vi.mock("@/lib/speaking", () => ({
  get isSpeakerFormOpen() {
    return data.formOpen;
  },
  SPEAKER_FORM_URL: "https://forms.example/apply",
}));
vi.mock("@/lib/speakers", () => {
  const past = { name: "Past Person", title: "Founder", image: "/p.jpg", cohort: "past" };
  const current = { name: "New Person", title: "Builder", image: "/n.jpg", cohort: "2026" };
  return {
    get SpeakersList() {
      return data.announced ? [past, current] : [past];
    },
    is2026Speaker: (s: { cohort?: string }) => s.cohort === "2026",
    isPastSpeaker: (s: { cohort?: string }) => s.cohort !== "2026",
  };
});
vi.mock("@/lib/fonts", () => ({ gotham: { className: "" } }));
vi.mock("@/lib/hooks/use-subtle-animations", () => ({ useSubtleAnimations: () => { } }));
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
  data.formOpen = true;
  data.announced = true;
});

/** A plate's height on a phone (the base class) and on a laptop (sm:). */
/** A plate's height on a phone (the base class) and on a laptop (md:). */
function plateHeights(name: string) {
  const plate = screen.getByAltText(name).parentElement!;
  const phone = plate.className.match(/(?:^|\s)h-(\d+)/);
  const laptop = plate.className.match(/md:h-(\d+)/);
  expect(phone && laptop, `${name} plate has both heights`).toBeTruthy();
  return { phone: Number(phone![1]), laptop: Number(laptop![1]) };
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
    const heights = ["Monica", "Goldco", "Cake", "Bronzeco", "Rovv"].map(plateHeights);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i].phone, `tier ${i} is smaller than tier ${i - 1} on a phone`).toBeLessThan(heights[i - 1].phone);
      expect(heights[i].laptop, `tier ${i} is smaller than tier ${i - 1} on a laptop`).toBeLessThan(heights[i - 1].laptop);
    }
    expect(screen.getByAltText("Monica").parentElement!.className).toMatch(/ring-brand-gold/);
    const tiers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(tiers).toEqual([
      "Headline Sponsor",
      "Gold Sponsor",
      "Silver Sponsor",
      "Bronze Sponsor",
      "Mobility Sponsor",
    ]);
  });

  it("draws community, media and ecosystem partners as the smallest tier, in the same column", () => {
    data.partners = {
      headline: [logo("Monica")],
      official: [{ ...logo("Rovv"), role: "Mobility" }],
      community: [logo("Web3Bridge"), logo("Guild")],
    };
    render(<PartnersSection2026 />);
    expect(screen.getByRole("heading", { level: 3, name: "Community Partners" })).toBeTruthy();
    const community = plateHeights("Web3Bridge");
    const official = plateHeights("Rovv");
    expect(community.phone).toBeLessThan(official.phone);
    expect(community.laptop).toBeLessThan(official.laptop);
    // One plate style for every 2026 logo: white, not last year's dark tile.
    const plate = screen.getByAltText("Web3Bridge").parentElement!.className;
    expect(plate).toMatch(/(^|\s)bg-white(\s|$)/);
    expect(plate).not.toMatch(/bg-card-2/);
  });

  it("uses none of last year's partner tile styling", () => {
    const src = codeOnly(read("components/home/partners-2026.tsx"));
    expect(src).not.toMatch(/XBadge|grayscale|bg-card-2/);
  });

  it("shows a sponsor with no link, and sizes a linked plate the same as an unlinked one", () => {
    data.partners = {
      headline: [logo("Monica")],
      official: [
        { ...logo("Rovv"), role: "Mobility" },
        { name: "Nolink", logo: "/2026/sponsors/nolink.png", role: "Wallet" },
      ],
    };
    render(<PartnersSection2026 />);
    expect(screen.getByAltText("Nolink").closest("a")).toBeNull();
    // The link must fill its slot, or a linked plate shrinks to its logo.
    expect(screen.getByAltText("Rovv").closest("a")!.className).toMatch(/(^|\s)w-full(\s|$)/);
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
    // Said once, in the heading, not again under the logo.
    expect(screen.queryByText("Mobility")).toBeNull();
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
    expect(read("package.json")).not.toMatch(/embla-carousel-autoplay/);
  });

  it("keeps speaker names below the section title, and focus with the slide shown", () => {
    const carousel = codeOnly(read("components/carousel.tsx"));
    expect(carousel).not.toMatch(/<h2\b/);
    expect(carousel).toMatch(/<h3\b/);
    expect(carousel).toMatch(/selectedScrollSnap\(\)\][\s\S]{0,120}\.focus\(/);
    expect(carousel).toMatch(/group-focus-visible:ring-2/);
  });

  it.each([
    { formOpen: true, announced: true, apply: true, past: true, href: "/speakers", label: /See the full lineup/ },
    { formOpen: false, announced: true, apply: false, past: true, href: "/speakers", label: /See the full lineup/ },
    { formOpen: true, announced: false, apply: true, past: false, href: "/past-speakers", label: /See every past speaker/ },
    { formOpen: false, announced: false, apply: false, past: false, href: "/past-speakers", label: /See every past speaker/ },
  ])(
    "call open: $formOpen, 2026 names out: $announced",
    ({ formOpen, announced, apply, past, href, label }) => {
      data.formOpen = formOpen;
      data.announced = announced;
      const { container } = render(<SpeakersSection />);
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);

      const applyLink = screen.queryByRole("link", { name: "Apply to Speak" });
      const pastLink = screen.queryByRole("link", { name: "See Past Speakers" });
      expect(Boolean(applyLink)).toBe(apply);
      expect(Boolean(pastLink)).toBe(past);
      if (applyLink) {
        expect(applyLink.getAttribute("href")).toBe("/call-for-speakers");
        expect(applyLink.className).toMatch(/bg-brand-gold/);
      }
      // The archive is the aside, never a second primary.
      if (pastLink) expect(pastLink.className).not.toMatch(/bg-brand-gold/);
      // With neither row, no empty box is left behind.
      if (!apply && !past) expect(container.querySelector(".divide-y")).toBeNull();
    },
  );
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
          speaker({ name: "Caps", title: "CEO, OWEGO", company: "Owego" }),
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
    // Case does not make it a different company.
    expect(screen.getByText("CEO")).toBeTruthy();
  });

  it("frames phone portraits below the top, rings a focused card, and loads the first portrait first", () => {
    render(
      <FeaturedSpeakersGrid
        speakers={[speaker({ name: "First", title: "T" }), speaker({ name: "Second", title: "T" })]}
      />,
    );
    const [first, second] = screen.getAllByRole("img");
    // object-top on a 4:3 phone frame cut a tall portrait off at the mouth.
    expect(first.className).toMatch(/object-\[50%_20%\] sm:object-top/);
    expect(first.getAttribute("loading")).not.toBe("lazy");
    expect(second.getAttribute("loading")).toBe("lazy");
    const card = first.closest(".group")!;
    expect(card.className).toMatch(/has-\[>a:focus-visible\]:ring-2/);
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
    // Fades at the edge so it always reads as continuing; room for focus
    // rings; scrollbar hidden on touch only.
    expect(filters.className).toMatch(/mask-image:linear-gradient/);
    expect(filters.className).toMatch(/(^|\s)py-1(\s|$)/);
    expect(filters.className).toMatch(/pointer-coarse:\[scrollbar-width:none\]/);
    expect(filters.className).not.toMatch(/(^|\s)\[scrollbar-width:none\]/);
    for (const chip of within(filters).getAllByRole("button")) {
      expect(chip.className).toMatch(/shrink-0/);
    }
  });

  it.each([true, false])(
    "tells search results and link previews the right thing (2026 names out: %s)",
    async (announced) => {
      data.announced = announced;
      vi.resetModules();
      const { metadata } = await import("@/app/speakers/page");
      const said = JSON.stringify([
        metadata.description,
        metadata.openGraph?.title,
        metadata.openGraph?.description,
        metadata.twitter?.title,
        metadata.twitter?.description,
      ]);
      if (announced) {
        expect(said).toContain("The 2026 Lineup");
        expect(said).not.toMatch(/Coming Soon|coming weeks|lands soon/);
      } else {
        expect(said).toMatch(/Coming Soon/);
        expect(said).not.toContain("The 2026 Lineup");
      }
    },
  );

  it("reads the archive line properly", () => {
    expect(codeOnly(read("app/speakers/page.tsx"))).not.toMatch(/Browse previous editions of past\s+speakers/);
  });
});
