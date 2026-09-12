"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ConsoleTab {
  href: string;
  label: string;
}

/**
 * Navigation for the console.
 *
 * A flat item with a bottom edge navigates. A rounded pill filters. That rule
 * exists because the participants screen had a campaign switcher and a set of
 * filter chips rendered with a byte-identical class string, so a control that
 * reloaded the page looked exactly like one that did not.
 *
 * Scrolls horizontally inside itself rather than wrapping, and the overflow
 * lives on this nav rather than on anything wrapping the sticky header: a
 * scroll container in an ancestor silently stops position:sticky working.
 */
export function ConsoleTabs({ tabs }: { tabs: ConsoleTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Console"
      className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        // Exact match for the queue, prefix for the rest, so /admin does not
        // light up while you are on /admin/participants.
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-12 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
              active
                ? "border-brand-gold text-brand-gold"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
