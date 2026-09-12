"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

/**
 * A value to copy, with the button next to it.
 *
 * Extracted from the registration success screen, where a creator gets their
 * referral link and can copy it in one tap. Their own page printed a bare
 * referral code with the words "Share it" and nothing to share, while the
 * registration screen had already promised "Your referral link will be on your
 * dashboard shortly".
 *
 * The analytics event is a prop with no default, deliberately. The first
 * version of this reused the referral block's event name, which would have
 * fired a label about sharing every time somebody copied their access link. An
 * access link is a credential and copying one should not be measured at all,
 * so that call site passes nothing.
 */
export function CopyField({
  value,
  label,
  onCopied,
  shareTitle,
  shareText,
}: {
  value: string;
  /** For screen readers, since the button itself just says Copy. */
  label: string;
  /** Fired after a successful copy. Omit where measuring would be wrong. */
  onCopied?: () => void;
  /** When given, offers the native share sheet, which is how phones share. */
  shareTitle?: string;
  shareText?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some in-app browsers, which is exactly
      // where this link is most often opened. Saying so beats appearing to work.
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: value,
      });
    } catch {
      // Includes the user simply dismissing the sheet, so this stays silent.
    }
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-white/20 bg-ground px-4 py-3 text-sm text-white">
        {value}
      </code>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          aria-label={label}
          className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/15 sm:flex-none"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
        {shareTitle && canShare && (
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
        )}
      </div>
    </div>
  );
}
