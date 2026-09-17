"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/shared/panel";

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
 */
export function Confirm({
  label,
  question,
  consequence,
  confirmLabel,
  pending = false,
  intent = "primary",
  onConfirm,
}: {
  label: string;
  question: string;
  /** What happens that cannot be undone. Stated, not implied. */
  consequence: string;
  confirmLabel: string;
  pending?: boolean;
  intent?: "primary" | "danger";
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) cancelRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className={buttonClass(intent)}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={label}
      className="w-full rounded-lg border-l-2 border-brand-gold bg-brand-gold/[0.08] p-4"
    >
      <p className="text-sm font-semibold text-white">{question}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
        {consequence}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Cancel first and focused, so the default action of pressing enter
            is the one that changes nothing. */}
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setAsking(false)}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className={buttonClass(intent)}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
