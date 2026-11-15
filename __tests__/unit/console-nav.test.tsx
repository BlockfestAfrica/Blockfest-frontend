/**
 * The console's grouped menu (lib/admin/console-nav.ts).
 *
 * The owner asked for a dashboard where every job can be found on its own,
 * so the menu is the map of the console. These hold it to the pages: every
 * line opens a real screen, every screen is on the map, owner screens are
 * left out for a reviewer and refuse one who types the address anyway, and
 * the line lit is the screen you are on.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeNavHref, CONSOLE_NAV, consoleNavFor, navLabelFor } from "@/lib/admin/console-nav";

const nav = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const { ConsoleNav } = await import("@/components/admin/console-nav");

const CONSOLE = join(process.cwd(), "app/admin/(console)");

/** The page file a console address is served from. */
const pageFor = (href: string) => join(CONSOLE, href.replace(/^\/admin\/?/, ""), "page.tsx");

/** Every console page, as the address it is served at. */
function consolePages(dir = CONSOLE, prefix = "/admin"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) found.push(...consolePages(abs, `${prefix}/${entry}`));
    else if (entry === "page.tsx") found.push(prefix);
  }
  return found;
}

const items = (groups = CONSOLE_NAV) => groups.flatMap((g) => g.sections.flatMap((s) => s.items));

/** Screens deliberately not in the menu, and why. */
const OFF_MENU: Record<string, string> = {
  "/admin/campaign/clear": "the purge, reached only from Pause and clear while the campaign is paused before launch",
  "/admin/tools": "a redirect kept for bookmarks; its four jobs each have a line now",
};

describe("the map", () => {
  it("points every line at a screen that exists", () => {
    for (const item of items()) {
      for (const href of [item.href, ...(item.also ?? [])]) {
        expect(existsSync(pageFor(href)), href).toBe(true);
      }
    }
  });

  it("has every screen on it, or says why not", () => {
    const listed = new Set(items().flatMap((i) => [i.href, ...(i.also ?? [])]));
    const missing = consolePages().filter((href) => !listed.has(href) && !OFF_MENU[href]);
    expect(missing, "a console page with no line in lib/admin/console-nav.ts").toEqual([]);
  });

  it("lists each screen once", () => {
    const hrefs = items().map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("makes every owner screen refuse a reviewer itself, not just leave it off the menu", () => {
    for (const item of items().filter((i) => i.owner)) {
      const src = readFileSync(pageFor(item.href), "utf8");
      expect(src, item.href).toMatch(/isOwner\(admin\.admin\)/);
      expect(src, item.href).toMatch(/OwnersOnly|Owners only/);
    }
  });

  it("keeps the old Tools address working", () => {
    expect(readFileSync(pageFor("/admin/tools"), "utf8")).toMatch(/redirect\("\/admin\/link-check"\)/);
  });
});

describe("what a reviewer sees", () => {
  it("is every screen not marked for owners, and no group left empty", () => {
    const reviewer = consoleNavFor(false);
    expect(items(reviewer).some((i) => i.owner)).toBe(false);
    expect(items(reviewer).map((i) => i.href)).toEqual(items().filter((i) => !i.owner).map((i) => i.href));
    expect(reviewer.map((g) => g.id)).toEqual(["monica", "rovv", "outreach"]);
    for (const group of reviewer) for (const section of group.sections) expect(section.items.length).toBeGreaterThan(0);
  });

  it("is everything, for an owner", () => {
    expect(items(consoleNavFor(true))).toEqual(items());
  });
});

describe("the line lit", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/admins", "/admin/admins"],
    ["/admin/rovv", "/admin/rovv"],
    ["/admin/rovv/winners", "/admin/rovv/winners"],
    ["/admin/winners", "/admin/winners"],
    ["/admin/winners/snapshots", "/admin/payouts"],
    ["/admin/campaign/clear", "/admin/campaign"],
    ["/admin/nothing-here", null],
  ])("on %s is %s", (pathname, href) => {
    expect(activeNavHref(pathname, CONSOLE_NAV)).toBe(href);
  });

  it("names the screen for the phone header", () => {
    expect(navLabelFor("/admin/vote-domains", CONSOLE_NAV)).toBe("Blocked vote domains");
    expect(navLabelFor(null, CONSOLE_NAV)).toBeNull();
  });
});

describe("the groups", () => {
  const groupButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`, "i") });
  const link = (name: string) => screen.queryByRole("link", { name });

  beforeEach(() => {
    window.localStorage.clear();
    nav.pathname = "/admin";
  });
  afterEach(() => window.localStorage.clear());

  it("opens the group you are in and folds the rest", () => {
    render(<ConsoleNav groups={CONSOLE_NAV} />);
    expect(groupButton("Monica").getAttribute("aria-expanded")).toBe("true");
    expect(link("Review queue")?.getAttribute("aria-current")).toBe("page");
    expect(groupButton("ROVV").getAttribute("aria-expanded")).toBe("false");
    expect(link("Entries")).toBeNull();
  });

  it("opens and closes from the heading, and remembers it", () => {
    render(<ConsoleNav groups={CONSOLE_NAV} />);
    fireEvent.click(groupButton("ROVV"));
    expect(link("Entries")).not.toBeNull();
    expect(JSON.parse(window.localStorage.getItem("console-nav:open") ?? "{}")).toMatchObject({ rovv: true });

    fireEvent.click(groupButton("ROVV"));
    expect(link("Entries")).toBeNull();
  });

  it("comes back the way it was left", async () => {
    window.localStorage.setItem("console-nav:open", JSON.stringify({ outreach: true }));
    await act(async () => {
      render(<ConsoleNav groups={CONSOLE_NAV} />);
    });
    expect(link("DPs generated")).not.toBeNull();
  });

  it("reopens a group you closed when you arrive in it, so where you are is never folded away", async () => {
    window.localStorage.setItem("console-nav:open", JSON.stringify({ rovv: false }));
    nav.pathname = "/admin/rovv/winners";
    await act(async () => {
      render(<ConsoleNav groups={CONSOLE_NAV} />);
    });
    expect(link("Winners")?.getAttribute("aria-current")).toBe("page");
  });

  it("closes the phone's sheet on a pick", () => {
    const picked = vi.fn();
    render(<ConsoleNav groups={CONSOLE_NAV} onNavigate={picked} />);
    fireEvent.click(link("Decided")!);
    expect(picked).toHaveBeenCalledTimes(1);
  });
});
