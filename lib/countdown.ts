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
