"use client";

import { useEffect, useRef } from "react";

/**
 * Remembers whether a collapsible card was left open, in this browser.
 *
 * Renders nothing: it finds the <details> it sits in and restores the state
 * the owner left it in, then saves every toggle. The card opens on the server
 * so it works without this; the stored state only arrives after mount. A card
 * someone arrives at by its #anchor is always opened, because a link that
 * lands on a closed card lands on nothing.
 *
 * Storage can be missing or refused (private windows, blocked site data), so
 * every read and write is guarded and the card simply stays as it rendered.
 */
export function RememberOpen({ storageKey, anchor }: { storageKey: string; anchor: string }) {
  const probe = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const details = probe.current?.closest("details");
    if (!details) return;

    if (window.location.hash === `#${anchor}`) {
      details.open = true;
    } else {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === "closed") details.open = false;
        if (stored === "open") details.open = true;
      } catch {
        // No storage: leave it as rendered.
      }
    }

    const save = () => {
      try {
        window.localStorage.setItem(storageKey, details.open ? "open" : "closed");
      } catch {
        // No storage: the toggle still works, it just is not remembered.
      }
    };
    details.addEventListener("toggle", save);
    return () => details.removeEventListener("toggle", save);
  }, [storageKey, anchor]);

  return <span ref={probe} hidden />;
}
