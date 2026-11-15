/**
 * The console's menu: every screen, in the group it belongs to.
 *
 * The console grew a tab at a time, Monica first and ROVV after, until the
 * rail was twelve flat words and a third of the jobs lived halfway down
 * pages named for something else: the reissue tool under Tools, blocked vote
 * domains under Winners, DP counts under Overview. The owner's ask was a
 * dashboard where each job can be found on its own, so every job worth
 * finding has its own screen and its own line here.
 *
 * Grouped by campaign first, because that is how the work arrives (a Monica
 * entry, a ROVV video), and a campaign added later is one more group rather
 * than a reshuffle. Within Monica, sections follow the week: reviewing what
 * came in, looking after the people, the results, and the setup behind it.
 * Then what reaches people beyond a campaign (Outreach: the /getdp counts and
 * the one-off emails), and the team itself (who has access, what they did).
 *
 * Plain data, no React and no server imports: the rail and the phone menu
 * render it, and a test walks it against the page files so a screen cannot
 * be added without a line here, or a line point at a screen that is gone.
 */

export interface ConsoleNavItem {
  href: string;
  label: string;
  /** Owner work. Hidden from reviewers; the page and its routes refuse them again. */
  owner?: boolean;
  /** Further screens reached from this one, lit as this item. */
  also?: string[];
}

export interface ConsoleNavSection {
  /** A small heading inside the group. Absent for the group's lead item. */
  label?: string;
  items: ConsoleNavItem[];
}

export interface ConsoleNavGroup {
  id: string;
  label: string;
  sections: ConsoleNavSection[];
}

export const CONSOLE_NAV: ConsoleNavGroup[] = [
  {
    id: "monica",
    label: "Monica",
    sections: [
      { items: [{ href: "/admin/overview", label: "Overview" }] },
      {
        label: "Review",
        items: [
          { href: "/admin", label: "Review queue" },
          { href: "/admin/decided", label: "Decided" },
          { href: "/admin/link-check", label: "Approved links" },
        ],
      },
      {
        label: "Creators",
        items: [
          { href: "/admin/participants", label: "People" },
          { href: "/admin/handle-requests", label: "Handle corrections", owner: true },
          { href: "/admin/reissue", label: "New personal link", owner: true },
          { href: "/admin/shared-addresses", label: "Shared addresses" },
        ],
      },
      {
        label: "Results",
        items: [
          { href: "/admin/winners", label: "Weekly winners", owner: true },
          { href: "/admin/payouts", label: "Payouts", owner: true, also: ["/admin/winners/snapshots"] },
          { href: "/admin/vote-domains", label: "Blocked vote domains", owner: true },
        ],
      },
      {
        label: "Setup",
        items: [
          { href: "/admin/challenges", label: "Weekly challenges", owner: true },
          { href: "/admin/points", label: "Points", owner: true },
          { href: "/admin/resources", label: "Pack resources", owner: true },
          { href: "/admin/campaign", label: "Pause and clear", owner: true },
        ],
      },
    ],
  },
  {
    id: "rovv",
    label: "ROVV",
    sections: [
      {
        items: [
          { href: "/admin/rovv", label: "Entries" },
          { href: "/admin/rovv/winners", label: "Winners", owner: true },
          { href: "/admin/rovv/testing", label: "Try it yourself", owner: true },
        ],
      },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    sections: [
      {
        items: [
          { href: "/admin/dps", label: "DPs generated" },
          { href: "/admin/emails", label: "Emails", owner: true },
        ],
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    sections: [
      {
        items: [
          { href: "/admin/audit", label: "Audit log", owner: true },
          { href: "/admin/admins", label: "Admins", owner: true },
        ],
      },
    ],
  },
];

/** The menu one admin sees: owner lines dropped for a reviewer, and emptied sections and groups with them. */
export function consoleNavFor(owner: boolean): ConsoleNavGroup[] {
  return CONSOLE_NAV.map((group) => ({
    ...group,
    sections: group.sections
      .map((section) => ({ ...section, items: section.items.filter((item) => owner || !item.owner) }))
      .filter((section) => section.items.length > 0),
  })).filter((group) => group.sections.length > 0);
}

const matches = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The line to light for a path: the most specific one that covers it, so
 * /admin/rovv/winners lights Winners rather than Entries, and a screen
 * reached from another (a recorded week, from Payouts) lights its parent.
 */
export function activeNavHref(pathname: string, groups: ConsoleNavGroup[]): string | null {
  let best: { href: string; length: number } | null = null;
  for (const group of groups) {
    for (const section of group.sections) {
      for (const item of section.items) {
        for (const path of [item.href, ...(item.also ?? [])]) {
          if (matches(pathname, path) && (!best || path.length > best.length)) {
            best = { href: item.href, length: path.length };
          }
        }
      }
    }
  }
  return best?.href ?? null;
}

/** The label of the screen a path is on, for the phone header. */
export function navLabelFor(href: string | null, groups: ConsoleNavGroup[]): string | null {
  if (!href) return null;
  for (const group of groups) {
    for (const section of group.sections) {
      const item = section.items.find((i) => i.href === href);
      if (item) return item.label;
    }
  }
  return null;
}
