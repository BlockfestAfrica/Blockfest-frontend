"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { ConfirmPanel } from "@/components/shared/confirm";

/**
 * The page's quiet last row: "Keeping your way back in" at the left, and
 * Sign out on this device at the right hand, asked once.
 *
 * Coming back needs the personal link from the registration email, opened in
 * this same browser. For the owner of the phone, who is the one person likely
 * to press this by mistake, that email may be long gone, and this page already
 * warns that in-app browsers keep their own cookies. So the question says what
 * getting back in takes before it happens.
 *
 * The trigger stays the form's submit button, so before the page has hydrated
 * a press still signs out rather than doing nothing. After hydration the press
 * opens the question under the row (so the row does not jump), and only "Yes"
 * submits the form to the server action.
 *
 * "Yes" clicks a hidden submit button rather than calling requestSubmit(),
 * which iOS only gained in 16. On an older iPhone, or the in-app browser
 * inside Instagram or WhatsApp on one, requestSubmit throws and the press
 * would silently do nothing, on the phones most likely to be borrowed.
 */
export function SignOutForm({
  action,
  help,
}: {
  action: () => Promise<void>;
  /** The disclosure's body, rendered on the server. None, no disclosure. */
  help?: ReactNode;
}) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState(false);

  return (
    <div className="relative mt-8 border-t border-line">
      {/* The form comes first in the DOM, so Sign out is reached before the
          help it sits beside rather than after it: with the help open, a
          form placed after it sent focus through every help link and then
          back up to the top right. It holds only the trigger (absolutely
          placed on the summary's row) and the hidden submit, so it takes no
          height, and without JavaScript the trigger still submits it. */}
      <form action={action}>
        <button
          ref={triggerRef}
          type="submit"
          onClick={(event) => {
            // A submit trigger acts through this handler, never the form's.
            event.preventDefault();
            setAsking(true);
          }}
          aria-expanded={asking}
          aria-label="Sign out on this device"
          className="absolute right-0 top-0 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-card-2 hover:text-white active:scale-[0.98] sm:px-5"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
        <button ref={submitRef} type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>

      {help ? (
        <details className="group">
          {/* list-none and a chevron: the default marker was hidden, which
              left a disclosure that did not look like one. pr-32 keeps the
              label clear of Sign out, which sits over this row, at every
              width: pl, not px, so sm:pl-5 cannot undo it. */}
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 pl-4 pr-32 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:text-white sm:pl-5 [&::-webkit-details-marker]:hidden">
            Keeping your way back in
            <ChevronDown
              className="h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          {help}
        </details>
      ) : (
        <div className="min-h-12" />
      )}

      {/* Outside the form: its buttons are type="button", and "Yes" submits
          through the hidden button above. */}
      {asking && (
        <div className="px-4 pb-4 sm:px-5">
          <ConfirmPanel
            label="Sign out on this device"
            question="Sign out on this device?"
            consequence="To get back in you need the link from your registration email, opened in this browser. If you no longer have it, the Lost your link page mails a new one."
            confirmLabel="Yes, sign me out"
            onCancel={() => {
              setAsking(false);
              triggerRef.current?.focus();
            }}
            onConfirm={() => {
              setAsking(false);
              submitRef.current?.click();
            }}
          />
        </div>
      )}
    </div>
  );
}
