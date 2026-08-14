"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Agenda } from "@/components/agenda";

/**
 * Last year's agenda, collapsed.
 *
 * /schedule answers "when is what in 2026", and the answer today is "not
 * published yet". Rendering the 2025 programme hour by hour underneath that
 * gave the page a wall of specific times that a buyer skimming it could easily
 * read as this year's, however it was labelled. Collapsed, "coming soon" is the
 * page's answer and 2025 is there for anyone who deliberately asks for it.
 */
export function PastAgenda() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="agenda-2025"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-900 transition-colors hover:border-brand-blue"
      >
        {open ? "Hide the 2025 schedule" : "See how 2025 ran, hour by hour"}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div id="agenda-2025" hidden={!open} className="mt-10">
        <Agenda />
      </div>
    </div>
  );
}
