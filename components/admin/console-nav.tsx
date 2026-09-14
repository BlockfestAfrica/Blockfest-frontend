"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ConsoleTab } from "@/components/admin/console-tabs";

/**
 * The sidebar navigation, desktop only.
 *
 * The complaint this answers, verbatim: the console read as "disconnected
 * looking table and data on the screen". A tab row floating above content
 * makes every screen look like a page that happens to have tabs; a persistent
 * rail makes the seven screens read as rooms in one building. The mobile
 * console keeps the horizontal tabs, because a rail on a phone spends a third
 * of the width on chrome.
 *
 * Same active rule as the tabs: exact match for the queue, prefix for the
 * rest, so /admin does not light up while you are on /admin/participants. The
 * active item gets the left edge the JobCards use for their state, so "where
 * am I" and "what is live" speak the same visual language.
 */
export function ConsoleNav({ tabs }: { tabs: ConsoleTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Console" className="flex flex-col gap-1">
      {tabs.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-r-lg border-l-2 px-4 text-sm font-semibold transition-colors ${
              active
                ? "border-l-brand-gold bg-card-2 text-white"
                : "border-l-transparent text-ink-3 hover:bg-card hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
