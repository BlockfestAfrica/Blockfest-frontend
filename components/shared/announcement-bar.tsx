"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { trackButtonClick } from "@/lib/sabilytics";
import { formatNaira, lowestTicketPrice } from "@/lib/tickets";

/**
 * Site-wide ticket announcement. Hidden on the tickets page itself.
 *
 * This used to carry the early bird offer and switch copy once it closed, which
 * meant resolving the deadline after mount so the server and client agreed on
 * the first render. The offer closed on 30 August, so there is one message now
 * and no clock to read.
 */
export function AnnouncementBar() {
  const pathname = usePathname();

  if (pathname === "/tickets") return null;

  return (
    <div className="bg-black">
      <Link
        href="/tickets"
        onClick={() => trackButtonClick("Announcement Bar", "Site Header")}
        className="group flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-3 text-center text-xs font-semibold text-white sm:text-sm min-h-11"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-brand-gold"
          aria-hidden="true"
        />
        <span>Tickets are live for Lagos &apos;26</span>
        <span className="hidden text-white/20 sm:inline">·</span>
        <span className="font-normal text-ink-3">
          {`Passes from ${formatNaira(lowestTicketPrice)}`}
        </span>
        <span className="inline-flex items-center gap-1 text-brand-gold underline underline-offset-2 group-hover:text-brand-gold-hover">
          Get yours
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}
