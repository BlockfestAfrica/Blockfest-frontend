"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FaArrowRight } from "react-icons/fa";
import { useUmami } from "@/lib/hooks/use-umami";
import { hasPassed } from "@/lib/countdown";
import { EARLY_BIRD_ENDS, formatNaira, lowestTicketPrice } from "@/lib/tickets";

/**
 * Site-wide ticket announcement. Hidden on the tickets page itself, and the
 * copy falls back to standard pricing once early bird closes.
 */
export function AnnouncementBar() {
  const pathname = usePathname();
  const { trackButtonClick } = useUmami();

  // Resolved after mount so the server and client render the same first pass.
  const [earlyBirdOver, setEarlyBirdOver] = useState(false);
  useEffect(() => {
    setEarlyBirdOver(hasPassed(EARLY_BIRD_ENDS.iso));
  }, []);

  if (pathname === "/tickets") return null;

  return (
    <div className="bg-brand-gold text-black">
      <Link
        href="/tickets"
        onClick={() => trackButtonClick("Announcement Bar", "Site Header")}
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-center text-xs font-semibold transition-opacity hover:opacity-80 sm:text-sm"
      >
        <span>
          {earlyBirdOver
            ? "Tickets are live for Lagos '26"
            : "Early bird tickets are live"}
        </span>
        <span className="hidden text-black/40 sm:inline">·</span>
        <span className="font-normal text-black/70">
          {earlyBirdOver
            ? `Passes from ${formatNaira(lowestTicketPrice)}`
            : `Save up to 25% until ${EARLY_BIRD_ENDS.display}`}
        </span>
        <span className="inline-flex items-center gap-1 underline underline-offset-2">
          Get yours
          <FaArrowRight className="text-[10px]" />
        </span>
      </Link>
    </div>
  );
}
