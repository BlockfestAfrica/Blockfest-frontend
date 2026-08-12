import { buildIcs } from "@/lib/calendar";

/** Serves the current edition as a calendar file. */
export const dynamic = "force-static";

export function GET() {
  return new Response(buildIcs(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="blockfest-africa-2026.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
