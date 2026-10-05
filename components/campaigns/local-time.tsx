"use client";

import { useEffect, useState } from "react";

/**
 * A deadline in the reader's own time, when that is not Lagos time.
 *
 * Every deadline on the site is said in Lagos time, which is right for most
 * creators and wrong for anybody reading from London, Johannesburg or
 * Toronto, who has to do the sum. A creator already misread a noon close as
 * midnight; making someone abroad convert time zones as well is the same
 * mistake waiting. So next to the Lagos time this adds "(11:00 your time)",
 * and the day too when it differs; in Lagos time it adds nothing.
 *
 * Renders nothing on the server and on the first paint, and works it out in
 * an effect: the device's zone is only known in the browser, and a first
 * render that disagreed with the server HTML would be a hydration error.
 */
export function LocalTime({ at, className = "" }: { at: string; className?: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    setLocal(yourTime(at));
  }, [at]);
  if (!local) return null;
  return <span className={className}> ({local} your time)</span>;
}

/**
 * "11:00", "Friday 23:00", or null when the zone shows the same day and time
 * as Lagos. `zone` defaults to the device's; it is a parameter so the rule
 * can be tested from any zone.
 */
export function yourTime(iso: string, zone?: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const read = (timeZone: string | undefined) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).formatToParts(at);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return { day: get("weekday"), time: `${get("hour")}:${get("minute")}` };
  };
  const lagos = read("Africa/Lagos");
  const mine = read(zone);
  if (mine.day === lagos.day && mine.time === lagos.time) return null;
  return mine.day === lagos.day ? mine.time : `${mine.day} ${mine.time}`;
}
