"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { hasPassed } from "@/lib/countdown";
import { CAMPAIGN_GATE_FORCED_OPEN } from "@/lib/campaigns";

/**
 * The join control, which refuses to be a join control before the campaign opens.
 *
 * Two things decide how this is built.
 *
 * The page is statically prerendered, so the date cannot be read at build time:
 * a page built on the 11th would have "not open yet" baked into it and would
 * still say so on the 14th, until someone happened to redeploy. The check
 * therefore runs after mount, the same way the ticket announcement bar resolves
 * its own deadline.
 *
 * And it fails closed. The server renders the locked state, and only a mounted
 * client that has actually compared the clock can unlock it. If JavaScript
 * never runs, or hydration fails, or the page is being read by something that
 * does not execute scripts, what it gets is the locked state. The opposite
 * default would put a live join link in front of someone a day before entries
 * are meant to be accepted, which is the failure that matters here.
 *
 * None of this is a security boundary. It is the honest surface of one. The
 * registration endpoint must make the same check server-side and reject
 * anything that arrives early, because a disabled button stops nobody who
 * knows the URL.
 */
export function CampaignJoinCTA({
  href,
  opensAt,
  opensLabel,
  children = "Join the challenge",
  className = "",
}: {
  href: string;
  /** ISO timestamp the campaign opens. */
  opensAt: string;
  /** How the opening is worded while it is still shut, e.g. "Monday 14 September". */
  opensLabel: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // The forced-open flag has to be honoured here as well as in the form and
    // the endpoint. Opening only the form leaves this control locked, and the
    // page offers no other way in, so the flow cannot be reached at all.
    setOpen(CAMPAIGN_GATE_FORCED_OPEN || hasPassed(opensAt));
  }, [opensAt]);

  const base =
    "inline-flex min-h-12 items-center gap-2 rounded-full px-8 text-base font-semibold transition-colors duration-300";

  if (!open) {
    return (
      <span
        className={`${base} cursor-not-allowed border border-white/20 bg-white/5 text-white/70 ${className}`}
        // Not a button. There is nothing to press, and a disabled button still
        // announces itself as one to a screen reader.
        role="status"
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        Entries open {opensLabel}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} bg-brand-gold text-black hover:bg-brand-gold-hover ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
