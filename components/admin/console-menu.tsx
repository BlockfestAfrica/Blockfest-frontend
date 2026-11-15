"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConsoleNav } from "@/components/admin/console-nav";
import { activeNavHref, navLabelFor, type ConsoleNavGroup } from "@/lib/admin/console-nav";

/**
 * The console menu on a phone.
 *
 * The phone used to carry the screens as a row of tabs scrolling sideways in
 * the sticky header, which worked at seven and stopped working at twelve:
 * most of them were off the edge, with nothing saying they were there. Now
 * the header names the screen you are on, and one button opens the same
 * grouped menu the desktop rail shows, as a sheet from the left that closes
 * itself when you pick something.
 */
export function ConsoleMenu({ groups }: { groups: ConsoleNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const here = navLabelFor(activeNavHref(pathname, groups), groups) ?? "Console";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open the console menu"
          className="-ml-2 flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-white hover:bg-card-2"
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{here}</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="w-[85vw] max-w-xs gap-0 overflow-y-auto overscroll-contain border-line bg-ground data-[state=closed]:duration-150 data-[state=open]:duration-200"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="px-2">
            <p className="eyebrow text-brand-gold">Blockfest</p>
            <SheetTitle className="mt-1 text-lg font-bold text-white">Console</SheetTitle>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close the menu"
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full hover:bg-card-3"
            >
              <X className="h-5 w-5 text-white" aria-hidden="true" />
            </button>
          </SheetClose>
        </div>
        <div className="px-2 pb-8">
          <ConsoleNav groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
