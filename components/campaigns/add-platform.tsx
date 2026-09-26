"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control } from "@/components/shared/panel";
import { ConfirmPanel } from "@/components/shared/confirm";
import { canonicalHandle } from "@/lib/campaign-registration";

/**
 * Add a platform you did not register with.
 *
 * Every handle is optional at registration, so somebody who only had X that
 * day registered X alone, and the ladder pays more for the same piece posted
 * on two or three platforms. Until this existed there was no way back:
 * submitting refused with "that platform is not registered", and the
 * correction form refused because there was nothing to correct.
 *
 * Deliberately not the correction form. That one files a request a person
 * reads, because swapping a handle can reassign authorship of work already
 * submitted. Adding a platform takes nothing from anybody, so it applies at
 * once and the creator can post the same day.
 */
export function AddPlatform({
  missing,
  platformLabels,
  paused = false,
}: {
  missing: string[];
  platformLabels: Record<string, string>;
  /** Submissions are paused campaign-wide, so "straight away" is not true. */
  paused?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  /*
   * Adding asks once, showing the username exactly as it will be stored, a
   * pasted profile link already reduced to the name. Once added, a username
   * can only be changed by a request the team approves, and until then every
   * post from the real account is refused: a typo costs a day in a campaign
   * with weekly deadlines.
   */
  const [confirming, setConfirming] = useState(false);

  if (missing.length === 0) return null;

  async function add(platform: string) {
    const value = handle.trim().replace(/^@/, "");
    if (!value) {
      toast.error("Enter your username.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/campaigns/monica/handles/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(
        paused
          ? `${platformLabels[platform] ?? platform} added. It is ready for when submissions reopen.`
          : `${platformLabels[platform] ?? platform} added. You can send a post from it now.`,
      );
      setOpen(null);
      setHandle("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="text-sm font-semibold text-white">
        Publishing somewhere else too?
      </p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
        {paused
          ? "Add the account now and it is ready for when submissions reopen. The same piece on more platforms counts as one entry and is worth more points."
          : "Add the account and you can send posts from it straight away. The same piece on more platforms counts as one entry and is worth more points."}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {missing.map((platform) => {
          const label = platformLabels[platform] ?? platform;
          const isOpen = open === platform;

          return (
            <div key={platform}>
              {!isOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(platform);
                    setHandle("");
                    setConfirming(false);
                  }}
                  className={buttonClass("secondary")}
                >
                  Add {label}
                </button>
              ) : (
                <div className="rounded-lg border border-line p-4">
                  <label
                    htmlFor={`add-${platform}`}
                    className="text-sm font-semibold text-white"
                  >
                    Your {label} username
                  </label>
                  <p className="mt-1 text-sm text-ink-4">
                    Your username, or paste your profile link and we will take
                    it from there. Posts you send must come from this account.
                  </p>
                  <input
                    id={`add-${platform}`}
                    name={`add-${platform}`}
                    autoComplete="off"
                    value={handle}
                    readOnly={confirming}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="yourname"
                    maxLength={41}
                    className={`${control} mt-2`}
                  />
                  {confirming ? (
                    <ConfirmPanel
                      className="mt-3"
                      label={`Add ${label}`}
                      question={`Add @${canonicalHandle(handle)} as your ${label} account?`}
                      consequence={`Every ${label} post you send has to come from @${canonicalHandle(handle)}. Once it is added, only the campaign team can change it, and that takes a request.`}
                      confirmLabel="Yes, add it"
                      cancelLabel="Go back"
                      onCancel={() => {
                        setConfirming(false);
                        document.getElementById(`add-${platform}`)?.focus();
                      }}
                      onConfirm={() => {
                        setConfirming(false);
                        add(platform);
                      }}
                    />
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          // Nothing to ask about an empty box; add() says so.
                          if (canonicalHandle(handle)) setConfirming(true);
                          else add(platform);
                        }}
                        className={buttonClass("primary")}
                      >
                        {busy ? "Adding…" : `Add ${label}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className={buttonClass("quiet")}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
