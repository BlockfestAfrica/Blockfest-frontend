"use client";

import { useEffect, useState } from "react";
import { calculateTimeLeft } from "@/lib/countdown";

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
 * spent to animate a number nobody is watching.
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
    const tick = () => setLabel(formatTimeLeft(endsAt));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return <span className="tabular-nums">{label}</span>;
}

/**
 * The same label on the server and in the browser.
 *
 * Coarse on purpose. "4 days left" is what somebody deciding whether to film
 * tonight needs; the exact closing instant is printed separately, because a
 * countdown alone leaves them guessing what hour they are counting to.
 */
export function formatTimeLeft(endsAt: string): string {
  const { days, hours, minutes } = calculateTimeLeft(endsAt);

  if (days === 0 && hours === 0 && minutes === 0) return "Closed";
  if (days >= 2) return `${days} days left`;
  if (days === 1) return `1 day, ${hours}h left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
