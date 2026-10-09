/**
 * Where people find /getdp. The owner asked for the Get DP page to be
 * reachable from wherever people already are (9 October): the main menu
 * (desktop from xl as "Get DP", and the phone menu), the footer, the home hero, and a
 * strip on the tickets, speakers, volunteer and partners pages that starts
 * the generator on that page's role.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GetDpStrip } from "@/components/shared/get-dp-strip";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/fonts", () => ({ gotham: { className: "", variable: "" } }));

describe("the Get DP strip", () => {
  it("links to the generator, starting on the page's role", () => {
    const { unmount } = render(<GetDpStrip role="speaker" lead="Speaking?" />);
    expect(screen.getByRole("link", { name: /Get your DP/ }).getAttribute("href")).toBe("/getdp?role=speaker");
    unmount();
    render(<GetDpStrip lead="Got your pass?" />);
    // The attendee default needs no role in the link.
    expect(screen.getByRole("link", { name: /Get your DP/ }).getAttribute("href")).toBe("/getdp");
  });

  it("says its one line to the page's audience", () => {
    render(<GetDpStrip role="volunteer" lead="Volunteering at Blockfest Africa '26?" />);
    expect(screen.getByText("Volunteering at Blockfest Africa '26?")).toBeTruthy();
  });
});

describe("where the links are", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("is on each audience's page, with that page's role", () => {
    expect(read("app/tickets/page.tsx")).toMatch(/<GetDpStrip\s+lead=/);
    expect(read("app/speakers/page.tsx")).toMatch(/<GetDpStrip\s+role="speaker"/);
    expect(read("app/volunteer/page.tsx")).toMatch(/<GetDpStrip\s+role="volunteer"/);
    expect(read("app/partners/page.tsx")).toMatch(/<GetDpStrip\s+role="partner"/);
  });

  it("is in the footer's Explore list, the main menu, the phone menu and the home hero", async () => {
    const { default: Footer } = await import("@/components/shared/footer");
    const { unmount } = render(<Footer />);
    expect(screen.getAllByRole("link", { name: "Get your DP" }).some((a) => a.getAttribute("href") === "/getdp")).toBe(true);
    unmount();
    const nav = read("components/shared/navbar.tsx");
    expect(nav.match(/href="\/getdp"/g)).toHaveLength(2);
    expect(read("components/home/hero-2026.tsx")).toMatch(/href="\/getdp"/);
  });
});
