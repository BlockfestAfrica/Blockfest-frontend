"use client";

import { trackCheckoutStarted, withHandoff } from "@/lib/sabilytics";
import { ArrowRight } from "lucide-react";
import { ticketUrl } from "@/lib/tickets";
import { cn } from "@/lib/utils";

interface TicketCTAProps {
  /** Which tier or section the click came from — sent to analytics. */
  source: string;
  /** The tier, when this button sells a specific one. Lets one pass be
      compared against another inside the same campaign. */
  pass?: string;
  children: React.ReactNode;
  variant?: "gold" | "outline";
  className?: string;
}

/** Links out to the ticket platform and records the click. */
export function TicketCTA({
  source,
  pass,
  children,
  variant = "gold",
  className,
}: TicketCTAProps) {
  const styles =
    variant === "gold"
      ? "bg-brand-gold text-black hover:bg-brand-gold-hover"
      : "bg-white/10 text-white border border-white/20 hover:bg-white/20";

  /**
   * Rewrite the href just before the browser follows it.
   *
   * The server renders a plain URL carrying the UTMs, which is what a visitor
   * with JavaScript off or the tracker blocked will use, so the link always
   * works. This upgrades it in place, on the interaction that is about to
   * navigate, rather than calling preventDefault and re-opening the window:
   * that keeps target="_blank" out of popup-blocker territory and leaves the
   * native middle-click and open-in-new-tab behaviour alone.
   *
   * pointerdown covers mouse and touch; focus covers keyboard, since it fires
   * before Enter activates the link.
   */
  const upgradeHref = (el: HTMLAnchorElement) => {
    const upgraded = withHandoff(ticketUrl(source));
    if (upgraded !== el.href) el.href = upgraded;
  };

  return (
    <a
      href={ticketUrl(source)}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(e) => upgradeHref(e.currentTarget)}
      onFocus={(e) => upgradeHref(e.currentTarget)}
      onClick={() => {
        trackCheckoutStarted(source, pass);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light",
        styles,
        className
      )}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
