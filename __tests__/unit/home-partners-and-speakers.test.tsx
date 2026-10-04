import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Partner, Sponsor } from "@/lib/partners-2026";
import type { Speaker } from "@/lib/speakers";

/*
 * The home page's partners and speakers, and the speakers page.
 *
 * The owner's asks: the partner tiers need a visible hierarchy (headline,
 * silver and mobility were near-identical boxes), then that the band per
 * category read as ugly and could not grow (more media, community and
 * government partners are coming), so it is two groups now with the
 * hierarchy kept by size; the lineup loses its Pause button, and both speaker
 * screens get tidied. These render the components and pin each of those.
 */

const data = vi.hoisted(() => ({
  headline: null as Sponsor | null,
  sponsors: [] as Sponsor[],
  partners: [] as Partner[],
  formOpen: true,
  announced: true,
}));

vi.mock("@/lib/partners-2026", () => ({
  get headline() {
    return data.headline;
  },
  get sponsors() {
    return data.sponsors;
  },
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
vi.mock("@/lib/speakers", async (importOriginal) => {
  // The real arrangement and order helpers; only the list is a fixture.
  const real = await importOriginal<typeof import("@/lib/speakers")>();
  const past = { name: "Past Person", title: "Founder", image: "/p.jpg", cohort: "past" };
  const current = { name: "New Person", title: "Builder", image: "/n.jpg", cohort: "2026" };
  return {
    get SpeakersList() {
      return data.announced ? [past, current] : [past];
    },
    arrangeLineup: real.arrangeLineup,
    lineupOrder: real.lineupOrder,
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

const { PartnersSection2026, partnerGroupLabel } = await import("@/components/home/partners-2026");
const { PartnersSection } = await import("@/components/home/partners");
const { logoWeight } = await import("@/components/home/partner-logo");
const { SpeakersSection } = await import("@/components/home/speakers");
const { FeaturedSpeakersGrid } = await import("@/components/speakers/2026-speakers-grid");

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

const logo = (name: string, over: Partial<Partner> = {}) => ({
  name,
  logo: `/2026/logos/${name.toLowerCase()}.png`,
  width: 600,
  height: 200,
  href: `https://x.com/${name.toLowerCase()}`,
  ...over,
});
const sponsor = (name: string, tier: string): Sponsor => ({ ...logo(name), tier });
const partner = (name: string, kind: Partner["kind"], over: Partial<Partner> = {}): Partner => ({
  ...logo(name, over),
  kind,
});

beforeEach(() => {
  data.headline = null;
  data.sponsors = [];
  data.partners = [];
  data.formOpen = true;
  data.announced = true;
});

/** A tile's height on a phone (the base class) and at its widest breakpoint. */
function tileHeights(name: string) {
  const tile = screen.getByAltText(name).parentElement!;
  const phone = tile.className.match(/(?:^|\s)h-(\d+)/);
  const wide = [...tile.className.matchAll(/(?:sm|md|lg):h-(\d+)/g)].map((m) => Number(m[1]));
  expect(phone && wide.length, `${name} tile has a phone and a wide height`).toBeTruthy();
  return { phone: Number(phone![1]), wide: Math.max(...wide) };
}

describe("2026 partners", () => {
  it("draws the headline, the sponsors and the partners each a clear step smaller", () => {
    data.headline = sponsor("Monica", "Headline");
    data.sponsors = [sponsor("Cake", "Silver"), sponsor("Rovv", "Mobility")];
    data.partners = [partner("Coinnews", "Media")];
    render(<PartnersSection2026 />);
    const [top, middle, wall] = ["Monica", "Cake", "Coinnews"].map(tileHeights);
    expect(middle.phone).toBeLessThan(top.phone);
    expect(wall.phone).toBeLessThan(middle.phone);
    expect(middle.wide).toBeLessThan(top.wide);
    expect(wall.wide).toBeLessThan(middle.wide);
    // Every logo on the same white tile.
    for (const name of ["Monica", "Cake", "Coinnews"]) {
      expect(screen.getByAltText(name).parentElement!.className).toMatch(/(^|\s)bg-white(\s|$)/);
    }
  });

  it("names only the headline sponsor's tier, and the partner wall once", () => {
    data.headline = sponsor("Monica", "Headline");
    data.sponsors = [sponsor("Cake", "Silver"), sponsor("Rovv", "Mobility")];
    data.partners = [
      partner("Coinnews", "Media"),
      partner("Times", "Media"),
      partner("Bridge", "Community"),
      partner("Lagos", "Government"),
    ];
    render(<PartnersSection2026 />);
    expect(within(screen.getByAltText("Monica").parentElement!).getByText("Headline sponsor")).toBeTruthy();
    // Only the headline is named; other sponsors carry no tier label.
    expect(screen.queryByText("Silver sponsor")).toBeNull();
    expect(screen.queryByText("Mobility sponsor")).toBeNull();
    expect(screen.getByRole("link", { name: "Cake, on X (opens in a new tab)" })).toBeTruthy();
    const groups = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual(["Sponsors", "Media, community & government partners"]);
    // A kind is said once, in the group's name, not under every logo.
    expect(screen.queryByText(/^Media( partner)?$/)).toBeNull();
    expect(screen.queryByText(/^Government( partner)?$/)).toBeNull();
  });

  it("names the partner group by the kinds it holds, in a fixed order", () => {
    expect(partnerGroupLabel([])).toBe("Partners");
    expect(partnerGroupLabel([partner("A", "Media")])).toBe("Media partners");
    expect(partnerGroupLabel([partner("A", "Government"), partner("B", "Media")])).toBe(
      "Media & government partners",
    );
    expect(
      partnerGroupLabel([
        partner("A", "Ecosystem"),
        partner("B", "Government"),
        partner("C", "Community"),
        partner("D", "Media"),
      ]),
    ).toBe("Media, community, government & ecosystem partners");
  });

  it("does not grow a band per category", () => {
    const src = codeOnly(read("components/home/partners-2026.tsx"));
    expect(src).not.toMatch(/TierLabel|Official Sponsors|Community Partners|Media Partners|Gold Sponsor/);
    expect(src).not.toMatch(/h-px flex-1/);
  });

  it("uses none of last year's dark tile styling, in either year", () => {
    for (const file of ["components/home/partners-2026.tsx", "components/home/partner-logo.tsx"]) {
      expect(codeOnly(read(file)), file).not.toMatch(/XBadge|grayscale|bg-card-2/);
    }
    // The 2025 wall draws its logos with the shared white tile, not its own.
    const past = codeOnly(read("components/home/partners.tsx"));
    expect(past).not.toMatch(/PartnerCard|grayscale/);
    expect(past).toMatch(/<LogoTile/);
  });

  it("sizes a logo by its shape, so a square mark and a wide wordmark carry similar weight", () => {
    expect(logoWeight({ width: 3, height: 1 })).toBeCloseTo(1);
    expect(logoWeight({ width: 1, height: 1 })).toBe(1.6);
    expect(logoWeight({ width: 8, height: 1 })).toBeCloseTo(Math.sqrt(3 / 8));
    expect(logoWeight({ width: 40, height: 1 })).toBe(0.5);

    data.partners = [
      partner("Seal", "Government", { width: 200, height: 200 }),
      partner("Wordmark", "Media", { width: 1600, height: 200 }),
    ];
    render(<PartnersSection2026 />);
    const factor = (name: string) =>
      Number((screen.getByAltText(name) as HTMLImageElement).style.height.match(/\*\s*([\d.]+)/)![1]);
    expect(factor("Seal")).toBeGreaterThan(factor("Wordmark"));
  });

  it("fits the sponsor row to how many sponsors there are", () => {
    const row = () => screen.getByAltText("S1").closest("ul")!.className;
    const cases: [number, RegExp, RegExp | null][] = [
      [1, /(^|\s)grid-cols-1(\s|$)/, /md:grid-cols/],
      [2, /(^|\s)grid-cols-2(\s|$)/, /md:grid-cols-3/],
      [3, /md:grid-cols-3/, null],
      [5, /md:grid-cols-4/, null],
    ];
    for (const [n, has, lacks] of cases) {
      data.sponsors = Array.from({ length: n }, (_, i) => sponsor(`S${i + 1}`, "Gold"));
      const { unmount } = render(<PartnersSection2026 />);
      expect(row(), `${n} sponsors`).toMatch(has);
      if (lacks) expect(row(), `${n} sponsors`).not.toMatch(lacks);
      unmount();
    }
  });

  it("leaves out an empty group", () => {
    data.partners = [partner("Coinnews", "Media")];
    const { unmount } = render(<PartnersSection2026 />);
    expect(screen.queryByRole("heading", { name: "Sponsors" })).toBeNull();
    unmount();

    data.headline = sponsor("Monica", "Headline");
    data.partners = [];
    render(<PartnersSection2026 />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Sponsors"]);
  });

  it("shows a partner with no link, and names every link by where it goes", () => {
    data.headline = sponsor("Monica", "Headline");
    data.partners = [
      partner("Site", "Community", { href: "https://site.example" }),
      partner("Nolink", "Media", { href: undefined }),
    ];
    render(<PartnersSection2026 />);
    expect(screen.getByRole("link", { name: "Monica, Headline sponsor, on X (opens in a new tab)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Site, website (opens in a new tab)" })).toBeTruthy();
    expect(screen.getByAltText("Nolink").closest("a")).toBeNull();
    expect(screen.queryByAltText(/sponsor logo/i)).toBeNull();
  });

  it("the real lists name everyone and point at prepared logos that exist", async () => {
    const real = await vi.importActual<typeof import("@/lib/partners-2026")>("@/lib/partners-2026");
    const { partners2025 } = await import("@/lib/partners-2025");
    const everyone = [
      ...(real.headline ? [real.headline] : []),
      ...real.sponsors,
      ...real.partners,
      ...partners2025,
    ];
    expect(everyone.length).toBeGreaterThan(0);
    for (const p of everyone) {
      expect(p.name.trim(), p.logo).not.toBe("");
      expect(existsSync(join(process.cwd(), "public", p.logo)), p.logo).toBe(true);
      expect(Number.isInteger(p.width) && p.width > 0, `${p.name} width`).toBe(true);
      expect(Number.isInteger(p.height) && p.height > 0, `${p.name} height`).toBe(true);
      if (p.href) expect(p.href, p.name).toMatch(/^https:\/\//);
    }
    // Nothing prepared and then forgotten.
    const used = new Set(everyone.map((p) => p.logo));
    for (const dir of ["images/partners-2025", "2026/logos"]) {
      for (const file of readdirSync(join(process.cwd(), "public", dir))) {
        expect(used.has(`/${dir}/${file}`), `/${dir}/${file} is used`).toBe(true);
      }
    }
  });
});

describe("2025 partners", () => {
  it("puts every previous partner on the same white tile as 2026", async () => {
    const { partners2025 } = await import("@/lib/partners-2025");
    const { PastPartnersWall } = await import("@/components/home/partners");
    render(<PastPartnersWall />);
    expect(screen.getAllByRole("img")).toHaveLength(partners2025.length);
    for (const p of partners2025) {
      const tile = screen.getByAltText(p.name).parentElement!;
      expect(tile.className, p.name).toMatch(/(^|\s)bg-white(\s|$)/);
    }
  });

  it("shows twelve on the home page, sponsors first, and links to the rest on /partners", async () => {
    const { partners2025 } = await import("@/lib/partners-2025");
    render(<PartnersSection />);
    const wall = screen.getAllByRole("list")[0];
    const shown = within(wall).getAllByRole("img");
    expect(shown).toHaveLength(12);
    expect(shown[0].getAttribute("alt")).toBe(partners2025[0].name);
    const more = screen.getByRole("link", {
      name: `See all ${partners2025.length} previous partners`,
    });
    expect(more.getAttribute("href")).toBe("/partners#previous-partners");
  });

  it("ends with the ways to partner, where the packages card was", () => {
    render(<PartnersSection />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Partner with Blockfest Africa 2026" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Sponsor",
      "Media partner",
      "Community partner",
      "Government & institutions",
    ]);
    expect(screen.queryByText(/View 2026 Packages/)).toBeNull();
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
