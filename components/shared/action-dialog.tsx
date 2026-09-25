"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * The follow-up to an action in a list, opened where the person is looking.
 *
 * Row actions in the console used to set state that rendered their form once,
 * after the whole list. On a long list that form appeared thousands of pixels
 * below the button, with no scroll and no focus move, so pressing Disqualify
 * or fix looked like it did nothing: the reason field that the action was
 * waiting for was somewhere nobody would think to look.
 *
 * A dialog puts the form in front of them instead, on every screen size: a
 * sheet from the bottom on a phone, where it sits under the thumb, and a
 * centred panel from the small breakpoint up. Radix supplies the parts that
 * are easy to get wrong by hand: focus moves into the dialog and is held
 * there, Escape and the backdrop close it, the page behind is inert to
 * assistive technology, and focus returns to the button that opened it.
 *
 * It opens on the first field marked `data-autofocus`, so the admin can type
 * the reason straight away, rather than on the close button, which is the
 * first focusable element and the one thing they did not come here to press.
 *
 * While `busy`, it cannot be dismissed. Closing mid-request would leave the
 * admin not knowing whether a disqualification or an award had gone through,
 * which is the one thing these forms exist to make certain.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = "default",
  busy = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being done, and to whom. */
  title: string;
  /** One sentence on what happens. Optional; the form may say it itself. */
  description?: string;
  /** Destructive actions get a red edge, the same signal the queue uses. */
  tone?: "default" | "danger";
  busy?: boolean;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const hold = (event: Event) => {
    if (busy) event.preventDefault();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          ref={content}
          onOpenAutoFocus={(event) => {
            const field =
              content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          onEscapeKeyDown={hold}
          onPointerDownOutside={hold}
          onInteractOutside={hold}
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-line-2 bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 ${
            tone === "danger" ? "border-t-2 border-t-red-400/70" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-white text-balance">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 max-w-prose text-sm leading-relaxed text-ink-3">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={busy}
                aria-label="Close"
                className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-card-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
