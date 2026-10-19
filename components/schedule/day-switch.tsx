"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { dayIndexOn } from "@/lib/run-of-show-layout";

export interface DayTab {
  /** "day-1": the hash that opens it, so /schedule#day-2 keeps working. */
  id: string;
  /** "Day 1". */
  name: string;
  /** "2026-10-22", to open the day it is on the day itself. */
  date: string;
  /** "Thu 22 Oct", for phones. */
  short: string;
  /** "Thursday 22 October", from the small breakpoint up. */
  long: string;
  /** "The main conference". */
  theme: string;
}

/**
 * Set on a history entry once this page has scrolled to a day for it, so a
 * reload or a Back to that entry keeps the reader where they were rather than
 * jumping to the top of the day again.
 */
const SCROLLED = "scheduleDayScrolled";

/** The day a hash names, or -1. A malformed hash ("#%") names none. */
function dayInHash(days: DayTab[]): number {
  let id = "";
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return -1;
  }
  return days.findIndex((day) => day.id === id);
}

const scrolledHere = () =>
  Boolean((window.history.state as Record<string, unknown> | null)?.[SCROLLED]);

/** Writes the day's hash in place: no history entry, so Back is not a day toggle. */
function writeHash(id: string) {
  window.history.replaceState(window.history.state, "", `#${id}`);
}

/**
 * The day switcher on /schedule: two tabs, one day shown.
 *
 * Both days are always in the HTML. The inactive one carries `hidden`, and
 * once the page is running it is upgraded to hidden="until-found", so the
 * browser's find-in-page still reaches the other day: a match there fires
 * `beforematch`, and this switches to that day (and writes its hash) before
 * the browser scrolls. Safari has no until-found, so its find stays on the
 * shown day. React 19.1 can only write a plain `hidden`, hence the upgrade
 * after it renders, and `aria-hidden` keeps the upgraded panel, which
 * Chrome would otherwise expose as an empty tabpanel, out of the
 * accessibility tree.
 *
 * Without JavaScript the <noscript> style in run-of-show.tsx unhides both
 * days and removes the controls, so the page is the plain two-day list.
 * While the page's script is still loading, or if it fails to, the tabs are
 * drawn but do nothing yet, and Day 1 shows.
 *
 * Which day opens: /schedule#day-2 opens Day 2; otherwise the day it is in
 * Lagos while the event is on, so on Friday the page opens on the main
 * conference; otherwise Day 1. The server always draws Day 1, so on the
 * Friday the switch to Day 2 lands as the page starts.
 *
 * The hash is never an element's id (the panels are "day-2-panel"), so the
 * browser itself never jumps to a day. Arriving at a day's hash scrolls to
 * its panel once per history entry; a reload or a Back to that entry is left
 * where the browser restores it. Picking a day writes its hash in place, so
 * the link can be shared. The foot of each day links to the other one,
 * because nothing can stick to the top of the screen on this site
 * (.interface-design/system.md), and a reader at the end of Day 1 should not
 * have to scroll back up to reach Day 2.
 *
 * A scroll to a day lands on its panel, never on the switcher, and the
 * panel's scroll margin is the switcher's height plus a little, so the
 * switcher stays in view above the day.
 */
export function DaySwitch({ days, panels }: { days: DayTab[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelEls = useRef<(HTMLDivElement | null)[]>([]);
  /* A scroll waits for the swap to render: until then the day being shown
     is still hidden and the other still takes up the page. */
  const scrollTo = useRef(-1);
  const [scrollTick, setScrollTick] = useState(0);

  const show = useCallback(
    (i: number, how: { focus?: boolean; scroll?: boolean; url?: boolean } = {}) => {
      setActive(i);
      if (how.url) writeHash(days[i].id);
      if (how.focus) tabs.current[i]?.focus({ preventScroll: true });
      if (how.scroll) {
        scrollTo.current = i;
        setScrollTick((n) => n + 1);
      }
    },
    [days],
  );

  useEffect(() => {
    if (scrollTo.current < 0 || scrollTo.current !== active) return;
    scrollTo.current = -1;
    panelEls.current[active]?.scrollIntoView({ block: "start" });
    window.history.replaceState({ ...(window.history.state ?? {}), [SCROLLED]: true }, "");
  }, [active, scrollTick]);

  // A day's hash on arrival, and any later in-page link to a day; else today's day.
  useEffect(() => {
    const named = dayInHash(days);
    if (named >= 0) show(named, { scroll: !scrolledHere() });
    else {
      const today = dayIndexOn(
        days.map((day) => day.date),
        new Date(),
      );
      if (today > 0) show(today);
    }
    const onHash = () => {
      const i = dayInHash(days);
      if (i >= 0) show(i, { scroll: true });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [days, show]);

  /* The hidden day stays findable with the browser's find-in-page, and out
     of the accessibility tree. Both only once the page is running: without
     JavaScript both days show, and both must be read. */
  useEffect(() => {
    panelEls.current.forEach((el, i) => {
      if (!el) return;
      if (i === active) el.removeAttribute("aria-hidden");
      else {
        el.setAttribute("hidden", "until-found");
        el.setAttribute("aria-hidden", "true");
      }
    });
  }, [active]);

  useEffect(() => {
    const offs = panelEls.current.map((el, i) => {
      if (!el) return undefined;
      const reveal = () => {
        flushSync(() => setActive(i));
        writeHash(days[i].id);
      };
      el.addEventListener("beforematch", reveal);
      return () => el.removeEventListener("beforematch", reveal);
    });
    return () => offs.forEach((off) => off?.());
  }, [days]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = days.length - 1;
    const to =
      event.key === "ArrowRight"
        ? i === last
          ? 0
          : i + 1
        : event.key === "ArrowLeft"
          ? i === 0
            ? last
            : i - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (to < 0) return;
    event.preventDefault();
    show(to, { focus: true, url: true });
  };

  const jump = (event: MouseEvent<HTMLAnchorElement>, i: number) => {
    // A modified or middle click opens the link the browser's way, in a new tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show(i, { focus: true, scroll: true, url: true });
  };

  return (
    <div>
      <div data-schedule-js>
        <div
          role="tablist"
          aria-label="Choose a day"
          className="flex divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white sm:max-w-xl"
        >
          {days.map((day, i) => {
            const on = i === active;
            return (
              <button
                key={day.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${day.id}-tab`}
                aria-selected={on}
                aria-controls={`${day.id}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => show(i, { url: true })}
                onKeyDown={(event) => onKeyDown(event, i)}
                className={`relative flex min-h-16 flex-1 basis-0 flex-col justify-center px-4 py-3 text-left -outline-offset-2 transition-colors duration-150 sm:px-5 ${
                  on ? "text-gray-900" : "text-gray-500 hover:bg-paper-muted hover:text-gray-900"
                }`}
              >
                <span className="text-base font-bold leading-tight sm:text-lg">{day.name}</span>
                <span className="sr-only">, </span>
                <span className="mt-0.5 text-sm leading-tight">
                  <span className="sm:hidden">{day.short}</span>
                  <span className="hidden sm:inline">{day.long}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-0.5 ${on ? "bg-brand-blue" : "bg-transparent"}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {days.map((day, i) => {
        const on = i === active;
        // The next day, or from the last day back to the one before it.
        const forward = i + 1 < days.length;
        const other = forward ? days[i + 1] : days[i - 1];
        return (
          <div
            key={day.id}
            ref={(el) => {
              panelEls.current[i] = el;
            }}
            id={`${day.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${day.id}-tab`}
            hidden={!on}
            tabIndex={on ? 0 : undefined}
            data-schedule-panel={day.id}
            className="scroll-mt-24 rounded-sm"
          >
            {panels[i]}
            {other && (
              <a
                href={`#${other.id}`}
                onClick={(event) => jump(event, days.indexOf(other))}
                data-schedule-js
                className="group mt-8 flex min-h-11 items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 transition-colors duration-150 hover:border-brand-blue sm:max-w-xl sm:px-5"
              >
                {!forward && (
                  <ArrowLeft className="h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                )}
                <span className={`min-w-0 flex-1 ${forward ? "" : "text-right"}`}>
                  {/* One text node: Chrome drops a space that stands alone
                      between two, and read "Back toDay 1". */}
                  <span className="block text-sm text-gray-500">
                    {`${forward ? "Next:" : "Back to"} ${other.name} · ${other.short}`}
                  </span>
                  <span className="mt-0.5 block text-base font-bold text-gray-900 group-hover:text-brand-blue">
                    {other.theme}
                  </span>
                </span>
                {forward && (
                  <ArrowRight className="h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                )}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
