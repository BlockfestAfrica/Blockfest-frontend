"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { activeNavHref, type ConsoleNavGroup } from "@/lib/admin/console-nav";

const STORAGE_KEY = "console-nav:open";

/**
 * The console's menu, grouped (lib/admin/console-nav.ts).
 *
 * Each group opens and closes from its heading, and the choice is
 * remembered in this browser. The group holding the screen you are on is
 * opened whenever you arrive in it, so the line that says where you are is
 * never folded away; you can still close it, and its heading stays white to
 * say you are inside.
 *
 * Same active rule as before, most specific line wins, with the gold edge the
 * JobCards use for their state, so "where am I" and "what is live" speak the
 * same visual language. Used in the desktop rail and in the phone's menu
 * sheet, which passes onNavigate to close itself.
 */
export function ConsoleNav({
  groups,
  onNavigate,
}: {
  groups: ConsoleNavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activeNavHref(pathname, groups);
  const activeGroup =
    groups.find((g) => g.sections.some((s) => s.items.some((i) => i.href === active)))?.id ?? null;

  /* Only what somebody chose. A group nobody has touched is open if it holds
     the current screen. Read after mount, so the server's render and the
     first client render agree. */
  const [chosen, setChosen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (stored && typeof stored === "object") setChosen(stored as Record<string, boolean>);
    } catch {
      // No storage, or something unreadable in it: every group as rendered.
    }
  }, []);

  // Arriving in a group opens it, even one closed earlier.
  useEffect(() => {
    if (!activeGroup) return;
    setChosen((prev) => (prev[activeGroup] === false ? remember({ ...prev, [activeGroup]: true }) : prev));
  }, [activeGroup, pathname]);

  const isOpen = (id: string) => chosen[id] ?? id === activeGroup;

  const toggle = (id: string) => setChosen((prev) => remember({ ...prev, [id]: !(prev[id] ?? id === activeGroup) }));

  return (
    <nav aria-label="Console" className="flex flex-col gap-1">
      {groups.map((group) => {
        const open = isOpen(group.id);
        const here = group.id === activeGroup;
        const panelId = `console-nav-${group.id}`;

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={open}
              aria-controls={panelId}
              className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-150 hover:bg-card ${
                here ? "text-white" : "text-ink-3 hover:text-white"
              }`}
            >
              {group.label}
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-ink-4 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
              />
            </button>

            <div id={panelId} hidden={!open} className="mb-3">
              {group.sections.map((section, i) => (
                <div key={section.label ?? i} className={section.label ? "mt-2.5" : "mt-1"}>
                  {section.label && (
                    <p className="px-4 pb-1 text-xs font-medium text-ink-4">{section.label}</p>
                  )}
                  <ul className="flex flex-col">
                    {section.items.map((item) => {
                      const current = item.href === active;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={current ? "page" : undefined}
                            className={`flex min-h-11 items-center rounded-r-lg border-l-2 px-4 text-sm font-semibold transition-colors duration-150 lg:min-h-8 ${
                              current
                                ? "border-l-brand-gold bg-card-2 text-white"
                                : "border-l-transparent text-ink-3 hover:bg-card hover:text-white"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function remember(state: Record<string, boolean>): Record<string, boolean> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // No storage: the toggle still works, it just is not remembered.
  }
  return state;
}
