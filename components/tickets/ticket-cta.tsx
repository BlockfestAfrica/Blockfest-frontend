"use client";

import { FaArrowRight } from "react-icons/fa";
import { useUmami } from "@/lib/hooks/use-umami";
import { TICKET_PLATFORM_URL } from "@/lib/tickets";
import { cn } from "@/lib/utils";

interface TicketCTAProps {
  /** Which tier or section the click came from — sent to analytics. */
  source: string;
  children: React.ReactNode;
  variant?: "gold" | "outline";
  className?: string;
}

/** Links out to the ticket platform and records the click. */
export function TicketCTA({
  source,
  children,
  variant = "gold",
  className,
}: TicketCTAProps) {
  const { trackButtonClick, trackRegistration } = useUmami();

  const styles =
    variant === "gold"
      ? "bg-brand-gold text-black hover:bg-brand-gold-hover"
      : "bg-white/10 text-white border border-white/20 hover:bg-white/20";

  return (
    <a
      href={TICKET_PLATFORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackButtonClick("Get Ticket", source);
        trackRegistration(source);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light",
        styles,
        className
      )}
    >
      {children}
      <FaArrowRight className="text-xs" />
    </a>
  );
}
