/**
 * The partners page and the ways to become a partner.
 *
 * The owner asked for both after the partner walls were rebuilt: a
 * "become a media partner" style call to action per kind of partner, the
 * way TOKEN2049 and Web Summit invite them, and a /partners page holding the
 * full list so the home page does not grow with it. These render both and
 * pin where every button goes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONTACT_EMAIL } from "@/lib/constants";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sabilytics", () => ({ trackButtonClick: track }));

const { PartnerPaths } = await import("@/components/partners/partner-paths");
const { partnerPaths } = await import("@/lib/partner-paths");
const page = await import("@/app/partners/page");
const { headline, sponsors, partners } = await import("@/lib/partners-2026");
const { partners2025 } = await import("@/lib/partners-2025");
const { default: sitemap } = await import("@/app/sitemap");

describe("the ways to partner", () => {
  it("offers one per kind, sponsor first", () => {
    render(<PartnerPaths location="Test" />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Sponsor",
      "Media partner",
      "Community partner",
      "Government & institutions",
    ]);
  });

  it("sends sponsors to the deck, and the rest to the partnerships inbox with the subject filled in", () => {
    render(<PartnerPaths location="Test" />);
    const deck = screen.getByRole("link", { name: /^Get the deck/ });
    expect(deck.getAttribute("href")).toBe("/#sponsorship");

    const subjects: Record<string, string> = {
      "Email us about a media partnership": "Media Partnership - Blockf3st Africa 2026",
      "Email us about a community partnership": "Community Partnership - Blockf3st Africa 2026",
      "Email us about an institutional partnership": "Institutional Partnership - Blockf3st Africa 2026",
    };
    for (const [name, subject] of Object.entries(subjects)) {
      const href = screen.getByRole("link", { name }).getAttribute("href")!;
      const url = new URL(href);
      expect(url.protocol, name).toBe("mailto:");
      expect(url.pathname, name).toBe(CONTACT_EMAIL);
      expect(url.searchParams.get("subject"), name).toBe(subject);
    }
  });

  it("names every button uniquely, starting with the words it shows", () => {
    for (const path of partnerPaths) {
      expect(path.label.startsWith(path.action), path.id).toBe(true);
    }
    expect(new Set(partnerPaths.map((p) => p.label)).size).toBe(partnerPaths.length);
  });

  it("makes only the sponsor button gold, and keeps every button on one line", () => {
    render(<PartnerPaths location="Test" />);
    for (const link of screen.getAllByRole("link")) {
      const gold = /(^|\s)bg-brand-gold(\s|$)/.test(link.className);
      expect(gold, link.getAttribute("aria-label")!).toBe(link.getAttribute("href") === "/#sponsorship");
      expect(link.className).toMatch(/whitespace-nowrap/);
      expect(link.className).toMatch(/min-h-11/);
    }
  });

  it("records which one was pressed, and where", () => {
    track.mockClear();
    render(<PartnerPaths location="Partners page" />);
    fireEvent.click(screen.getByRole("link", { name: "Email us about a media partnership" }));
    expect(track).toHaveBeenCalledWith("Partner path: media", "Partners page");
  });

  it("titles its cards one level under whatever holds them", () => {
    render(<PartnerPaths location="Test" headingLevel="h4" />);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(partnerPaths.length);
  });
});

describe("the /partners page", () => {
  it("holds the whole 2026 wall, the ways in, and all of 2025, in that order", () => {
    render(<page.default />);
    expect(screen.getByRole("heading", { level: 1, name: "Our partners" })).toBeTruthy();
    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(sections[0]).toBe("Sponsors");
    expect(sections.slice(-2)).toEqual(["Become a partner", "Previous partners"]);

    const logos = (headline ? 1 : 0) + sponsors.length + partners.length + partners2025.length;
    expect(screen.getAllByRole("img")).toHaveLength(logos);
  });

  it("has the anchors the home page and its own link point at", () => {
    const { container } = render(<page.default />);
    expect(container.querySelector("#become-a-partner")).toBeTruthy();
    expect(container.querySelector("#previous-partners")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Become a partner" }).getAttribute("href")).toBe(
      "#become-a-partner",
    );
  });

  it("shares as itself, with its own card, and brands its title once", () => {
    const og = page.metadata.openGraph as { url?: string; images?: { url: string }[] };
    expect(og.url).toMatch(/\/partners$/);
    expect(og.images?.[0]?.url).toMatch(/\/images\/og-image\.jpg$/);
    const twitter = page.metadata.twitter as { title?: string; images?: string[] };
    expect(twitter.title).toMatch(/^Partners/);
    expect(twitter.images?.length).toBeGreaterThan(0);
    // The root layout's template adds the brand.
    expect(page.metadata.title).toBe("Partners");
  });

  it("is its own canonical page, in the sitemap and the footer", () => {
    expect(String(page.metadata.alternates?.canonical)).toMatch(/\/partners$/);
    expect(sitemap().some((entry) => entry.url.endsWith("/partners"))).toBe(true);
    const footer = readFileSync(join(process.cwd(), "components/shared/footer.tsx"), "utf8");
    expect(footer).toMatch(/\{ path: "\/partners", title: "Partners" \}/);
  });
});
