export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Time remaining until an ISO date, clamped to zero once it has passed. */
export function calculateTimeLeft(targetDate: string): TimeLeft {
  const difference = new Date(targetDate).getTime() - new Date().getTime();
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

/** True once the target date is in the past. */
export function hasPassed(targetDate: string): boolean {
  return new Date(targetDate).getTime() <= new Date().getTime();
}

/**
 * How long is left, as one short label.
 *
 * Lives here rather than beside the component that animates it, because both a
 * server component and a client component need to call it and this module
 * carries no directive either way.
 *
 * That distinction is not cosmetic. It was exported from a "use client" module
 * and called from the server page, which type-checks, builds, and passes every
 * test, then throws at request time: Next replaces the exports of a client
 * module with client references when a server component imports them, so
 * calling one on the server is not calling a function. The line only ran when a
 * challenge was open, which is only ever on the signed-in path, so the page
 * returned 200 to everybody without a session and 500 to every creator who had
 * one.
 *
 * Coarse on purpose. "4 days left" is what somebody deciding whether to film
 * tonight needs; the exact closing instant is printed separately.
 */
export function formatTimeLeft(endsAt: string): string {
  const { days, hours, minutes } = calculateTimeLeft(endsAt);

  if (days === 0 && hours === 0 && minutes === 0) return "Closed";
  if (days >= 2) return `${days} days left`;
  if (days === 1) return `1 day, ${hours}h left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
