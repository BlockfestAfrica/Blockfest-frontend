"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control } from "@/components/shared/panel";

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
}: {
  missing: string[];
  platformLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

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
        `${platformLabels[platform] ?? platform} added. You can send a post from it now.`,
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
        Add the account and you can send posts from it straight away. The same
        piece on more platforms counts as one entry and is worth more points.
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
                    Exactly as it appears on your profile. Posts you send must
                    come from this account.
                  </p>
                  <input
                    id={`add-${platform}`}
                    name={`add-${platform}`}
                    autoComplete="off"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="yourname"
                    maxLength={41}
                    className={`${control} mt-2`}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => add(platform)}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
