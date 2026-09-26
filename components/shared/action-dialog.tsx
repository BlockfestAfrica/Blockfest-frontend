"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

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
 * there, and the page behind is inert to assistive technology.
 *
 * Escape, the close button and the form's own Cancel close it. A tap on the
 * backdrop does not: on a phone that tap is how people put the keyboard away,
 * and it would throw away a typed reason or a long resource body without a
 * word.
 *
 * Focus goes back to the button that opened it. Radix only does that for its
 * own Trigger, and these are opened from state by buttons in a list, so the
 * opener is remembered here; without it, closing dropped focus to the top of
 * the page and a keyboard user had to tab back down forty rows.
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
  /** The button that opened this, so focus can go back to it on close. */
  const opener = useRef<HTMLElement | null>(null);
  const hold = (event: Event) => {
    if (busy) event.preventDefault();
  };

  /*
   * Recorded as the dialog opens, before any child's effect can move focus.
   *
   * onOpenAutoFocus alone missed a dialog that opens with a question already
   * showing (the resource editor asking about an unsaved draft): the question
   * focuses its own Cancel first, Radix then finds focus already inside and
   * skips its open focus, and closing had nowhere to send focus back to.
   */
  useLayoutEffect(() => {
    if (open && !opener.current) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

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
            opener.current ??=
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            const field =
              content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const back = opener.current;
            opener.current = null;
            const active = document.activeElement;
            // Only when nothing else has taken focus on the way out: the
            // week editor's discard path moves the cursor into the next
            // week's title, and that should stand.
            if (
              (!active || active === document.body) &&
              back?.isConnected &&
              !(back instanceof HTMLButtonElement && back.disabled)
            ) {
              back.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            hold(event);
            // Escape on a question inside the dialog answers the question
            // ("Keep editing"), not the dialog. Radix hears Escape on the
            // document before the question does, so it is held here.
            if (
              event.target instanceof Element &&
              event.target.closest('[role="alertdialog"]')
            ) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={hold}
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-line-2 bg-ground p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 ${
            tone === "danger" ? "border-t-2 border-t-red-400/70" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-white text-balance [overflow-wrap:anywhere]">
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
