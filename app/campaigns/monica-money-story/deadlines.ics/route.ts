import { buildDeadlinesIcs } from "@/lib/stage-calendar";

/**
 * The remaining stage deadlines as a calendar file (lib/stage-calendar.ts).
 * Rebuilt hourly, so a deadline that has passed drops out of it.
 */
export const revalidate = 3600;

export function GET() {
  return new Response(buildDeadlinesIcs(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="monica-deadlines.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
