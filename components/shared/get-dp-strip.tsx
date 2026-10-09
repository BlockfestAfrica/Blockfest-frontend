import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DPRole } from "@/app/getdp/lib/dp";

/**
 * A pointer to /getdp, said to the people on the page in front of it: a
 * speaker on /speakers, a volunteer on /volunteer, a partner on /partners,
 * someone who just bought a pass on /tickets. The owner asked for the Get
 * DP page to be easy to find from wherever people already are (9 October).
 *
 * The link carries the role (`?role=speaker`) so the generator can start on
 * it; the attendee default needs none. A strip, not a section: one line and
 * one button, under a hairline, so it never competes with the page's own
 * call to action.
 */
export function GetDpStrip({
  role = "attendee",
  lead,
  tone = "dark",
}: {
  role?: DPRole;
  /** One sentence to this page's audience. */
  lead: string;
  /** The page's ground: most pages are navy, /speakers is paper. */
  tone?: "dark" | "light";
}) {
  const href = role === "attendee" ? "/getdp" : `/getdp?role=${role}`;
  const light = tone === "light";
  return (
    <div className={light ? "border-t border-gray-200 bg-paper" : "border-t border-line-2 bg-ground"}>
      <div className="container-page flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-base ${light ? "text-gray-600" : "text-ink-2"}`}>{lead}</p>
        <Link
          href={href}
          className={
            light
              ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-gray-200 px-6 text-sm font-semibold text-gray-900 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
              : "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line-2 px-6 text-sm font-semibold text-white transition-colors hover:bg-card-3 touch-manipulation"
          }
        >
          Get your DP
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
