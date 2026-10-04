"use client";

import { useEffect, useState } from "react";
import { formatTimeLeft } from "@/lib/countdown";

/**
 * How long is left, counted down in the browser.
 *
 * The server renders a label and this takes over from it. It never computes
 * from the current time during the first render: the server and the client are
 * milliseconds apart at best and minutes apart when a page is served from a
 * cache, and a first render that disagrees with the server HTML is a hydration
 * error on every load. So the first paint is exactly what the server sent, and
 * the clock only starts inside the effect.
 *
 * Once a minute, not once a second. Nothing here is decided in the last second
 * of a week, and a per-second interval on a page people leave open is battery
 * spent to animate a number nobody is watching. But each tick lands on the
 * close's own minute boundaries, not a minute after the page opened: counted
 * from the mount, "Under a minute left" stayed up for as much as a minute
 * after entries had shut, and "1m left" with a second to go.
 */
export function TimeLeftLabel({
  endsAt,
  initial,
}: {
  /** ISO string. calculateTimeLeft parses a string; a Date gives NaN. */
  endsAt: string;
  /** What the server rendered. Shown until the first tick. */
  initial: string;
}) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      // Read before the label, so a label written in the instant after the
      // close is never left without a next tick to correct it.
      const left = new Date(endsAt).getTime() - Date.now();
      setLabel(formatTimeLeft(endsAt));
      // Just past the next whole minute before the close, and so just past
      // the close itself on the last one. Never more than a minute away.
      if (left > 0) timer = setTimeout(tick, (left % 60_000) + 1);
    };
    tick();
    return () => clearTimeout(timer);
  }, [endsAt]);

  return <span className="tabular-nums">{label}</span>;
}
