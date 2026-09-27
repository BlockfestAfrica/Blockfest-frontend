"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/shared/panel";

/**
 * A value to copy, as one row of a card: the value itself, whole and
 * selectable, and Copy (and Share, where the phone has a share sheet) at the
 * right hand as ordinary secondary buttons.
 *
 * Their own page once printed a bare referral code with the words "Share
 * it" and nothing to share, while the registration screen had already
 * promised "Your referral link will be on your dashboard shortly". The value
 * wraps rather than truncates, because the clipboard fallback asks people to
 * select it and copy it by hand. Share was gold, an action wearing the
 * status colour; it is secondary now.
 *
 * The analytics event is a prop with no default, deliberately. The first
 * version of this reused the referral block's event name, which would have
 * fired a label about sharing every time somebody copied their access link.
 * An access link is a credential and copying one should not be measured at
 * all, so a call site like that passes nothing.
 */
export function CopyField({
  value,
  label,
  hint,
  onCopied,
  shareTitle,
  shareText,
}: {
  value: string;
  /** For screen readers, since the button itself just says Copy. */
  label: string;
  /** One quiet line under the value. */
  hint?: string;
  /** Fired after a successful copy. Omit where measuring would be wrong. */
  onCopied?: () => void;
  /** When given, offers the native share sheet, which is how phones share. */
  shareTitle?: string;
  shareText?: string;
}) {
  const [copied, setCopied] = useState(false);
  /*
   * Asked after mount, not during render. The server has no navigator, so a
   * render-time check drew no Share on the server and a Share on a phone's
   * first client render, and the two disagreed.
   */
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (typeof navigator.share === "function") setCanShare(true);
  }, []);

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
      await navigator.share({ title: shareTitle, text: shareText, url: value });
    } catch {
      // Includes the user simply dismissing the sheet, so this stays silent.
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      {/* w-full as well as min-w-0: once this row stacks, the main axis is
          vertical and min-w-0 no longer constrains the width. */}
      <div className="w-full min-w-0 sm:flex-1">
        <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{value}</p>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={copy}
          aria-label={label}
          className={buttonClass("secondary", "min-w-24 flex-1 sm:flex-none")}
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
            className={buttonClass("secondary", "min-w-24 flex-1 sm:flex-none")}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
        )}
      </div>
    </div>
  );
}
