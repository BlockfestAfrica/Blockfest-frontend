"use client";

import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { isSpeakerFormOpen, SPEAKER_FORM_URL } from "@/lib/speaking";

/**
 * The apply control.
 *
 * Renders as a real link the moment SPEAKER_FORM_URL is set, and until then as
 * a button that says so rather than a dead anchor or a disabled control with no
 * explanation. Keeping both in one place means opening applications is a
 * one-line change in lib/speaking.ts, not an edit across the page.
 */
export function SpeakerApplyCTA({
  children = "Apply to speak",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover";

  if (isSpeakerFormOpen && SPEAKER_FORM_URL) {
    return (
      <a
        href={SPEAKER_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${className}`}
      >
        {children}
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        toast("Applications open soon", {
          description:
            "The form is not live yet. Follow @blockfestafrica and we will announce it there first.",
        })
      }
      className={`${base} cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
