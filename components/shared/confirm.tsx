"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass, type Intent } from "@/components/shared/panel";

/**
 * A second step before something that cannot be taken back.
 *
 * Announcing a winner commits prize money to a named person and publishes it.
 * It sat beside "Save as draft" at identical size and shape, distinguished only
 * by fill, as adjacent thumb targets on a phone, and nothing in the console
 * retracts an announcement afterwards.
 *
 * The question restates the name, the category and the formatted amount, so the
 * confirmation is a chance to notice a wrong number rather than a speed bump
 * that trains people to tap twice.
 *
 * Focus moves with a ref and an effect rather than autoFocus: autoFocus on a
 * phone opens the keyboard over the thing being confirmed.
 *
 * Some actions only need the question some of the time. Approving an entry is
 * the busiest press in the console and asking every time would train a double
 * tap, but approving with a note typed is the one mis-tap that pays someone a
 * reviewer meant to refuse. `when` asks only in that case and otherwise acts on
 * the first press, so the caller keeps one button instead of two branches.
 *
 * `triggerType="submit"` is for a trigger that is a form's submit button.
 * Pressing enter in a field clicks the form's submit button, so the question
 * opens from the keyboard too. The form's own onSubmit must not act: while the
 * question is open there is no submit button, and a form with a single field
 * still submits on enter.
 */
export function Confirm({
  label,
  question,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  pending = false,
  disabled = false,
  when = true,
  intent = "primary",
  triggerClassName,
  triggerContent,
  triggerType = "button",
  onConfirm,
}: {
  label: string;
  question: string;
  /** What happens that cannot be undone. Stated, not implied. */
  consequence: string;
  confirmLabel: string;
  /** For a trigger that is itself a cancel, where "Cancel" would say both. */
  cancelLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  /** Ask only when this is true; otherwise the first press acts. */
  when?: boolean;
  intent?: Intent;
  /** A trigger that keeps its own look, such as Approve's green. */
  triggerClassName?: string;
  /** A trigger that keeps its own content, such as an icon and its own busy label. */
  triggerContent?: ReactNode;
  triggerType?: "button" | "submit";
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  // Cancel puts focus back on the button that asked, rather than on nothing.
  useEffect(() => {
    if (!asking && refocus.current) {
      refocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  if (!asking) {
    /*
     * The busy state belongs here, on the collapsed trigger.
     *
     * Confirming closes the dialog in the same tick it calls onConfirm, so
     * this component is back to a plain button before the caller's
     * setBusy(true) has landed: the "Working…" on the confirm button below
     * could never render, and every caller passing `pending` was passing it
     * to something unreachable. What an owner actually saw, for the several
     * seconds an announce takes, was a slightly dimmer button and nothing
     * else, on the one action in the console that must not be pressed twice.
     */
    return (
      <button
        ref={triggerRef}
        type={triggerType}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={(event) => {
          // A submit trigger acts through this handler, never the form's.
          if (triggerType === "submit") event.preventDefault();
          if (when) setAsking(true);
          else onConfirm();
        }}
        className={triggerClassName ?? buttonClass(intent)}
      >
        {triggerContent ?? (pending ? "Working…" : label)}
      </button>
    );
  }

  return (
    <ConfirmPanel
      label={label}
      question={question}
      consequence={consequence}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      intent={intent}
      pending={pending}
      disabled={disabled}
      onCancel={() => {
        refocus.current = true;
        setAsking(false);
      }}
      onConfirm={() => {
        setAsking(false);
        onConfirm();
      }}
    />
  );
}

/**
 * The question on its own, for a caller that has to place it.
 *
 * Confirm puts the question where its button was, which works where the button
 * has a line to itself. The review queue's Approve sits in a tight row beside
 * Reject and the note field, so the queue keeps the buttons and shows this
 * under the row instead, with the same words, order and focus.
 */
export function ConfirmPanel({
  label,
  question,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  intent = "primary",
  pending = false,
  disabled = false,
  className = "",
  onCancel,
  onConfirm,
}: {
  label: string;
  question: string;
  consequence: string;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: Intent;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-label={label}
      onKeyDown={(event) => {
        // Inside an ActionDialog, the dialog holds its own Escape when it
        // comes from here, so only the question closes.
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      className={`w-full rounded-lg border-l-2 border-brand-gold bg-brand-gold/[0.08] p-4 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-white [overflow-wrap:anywhere]">{question}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
        {consequence}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Cancel first and focused, so the default action of pressing enter
            is the one that changes nothing. */}
        {/* data-autofocus as well as the effect, so a dialog that picks its
            open focus by [data-autofocus] lands here too. */}
        <button
          ref={cancelRef}
          data-autofocus
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={pending || disabled}
          onClick={onConfirm}
          className={buttonClass(intent)}
        >
          {/* Kept for the case where a caller sets pending before the
              dialog closes; the collapsed trigger above is what actually
              carries the state for every caller in this codebase. */}
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
