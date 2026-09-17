"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/shared/panel";

/**
 * A quiet warning that the session is about to end.
 *
 * Sessions are twelve hours, absolute, with no renewal, because the defect
 * being fixed (#138) is a credential that renews forever and any renewal hands
 * a cookie thief the same property back. The cost of that choice is that a
 * reviewer could be signed out mid-queue with no warning, so this shows one in
 * the last thirty minutes. It renders nothing before then, and it is advisory:
 * the server holds the real expiry, the browser clock only decides when to warn.
 */
export function SessionClock({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (now === null) return null;

  const end = new Date(expiresAt).getTime();
  const minutesLeft = Math.floor((end - now) / 60_000);
  if (minutesLeft > 30) return null;

  if (minutesLeft <= 0) {
    return <Pill tone="bad">Session ended, sign in again</Pill>;
  }

  const label = new Date(end).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
  return <Pill tone="bad">Session ends {label}</Pill>;
}
