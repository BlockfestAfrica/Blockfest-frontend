"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackButtonClick, trackTicketIntent } from "@/lib/sabilytics";
import { hasPassed } from "@/lib/countdown";
import { EARLY_BIRD_ENDS, formatNaira, lowestTicketPrice } from "@/lib/tickets";

/**
 * Site-wide ticket announcement. Hidden on the tickets page itself, and the
 * copy falls back to standard pricing once early bird closes.
 */
export function AnnouncementBar() {
  const pathname = usePathname();

  // Resolved after mount so the server and client render the same first pass.
  const [earlyBirdOver, setEarlyBirdOver] = useState(false);
  useEffect(() => {
    setEarlyBirdOver(hasPassed(EARLY_BIRD_ENDS.iso));
  }, []);

  if (pathname === "/tickets") return null;

  return (
    <div className="bg-black">
      <Link
        href="/tickets"
        onClick={() => trackButtonClick("Announcement Bar", "Site Header")}
        className="group flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-3 text-center text-xs font-semibold text-white sm:text-sm min-h-11"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
        <span>
          {earlyBirdOver
            ? "Tickets are live for Lagos '26"
            : "Early bird tickets are live"}
        </span>
        <span className="hidden text-white/20 sm:inline">·</span>
        <span className="font-normal text-white/60">
          {earlyBirdOver
            ? `Passes from ${formatNaira(lowestTicketPrice)}`
            : `Save up to 25% until ${EARLY_BIRD_ENDS.display}`}
        </span>
        <span className="inline-flex items-center gap-1 text-brand-gold underline underline-offset-2 group-hover:text-brand-gold-hover">
          Get yours
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}
