"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { track } from "@/lib/sabilytics";

/**
 * Submitting an entry.
 *
 * The creator picks a platform and pastes a link. They do not choose the
 * challenge: the server decides which week is open, because there is one answer
 * at any moment and letting the page choose only creates a way to file an entry
 * against the wrong week, which stays invisible until results are published.
 *
 * Only platforms they registered are offered. The database refuses the rest
 * anyway, but a dropdown that lists a choice and then rejects it is a worse way
 * to learn that than not offering it.
 */
export function SubmissionForm({
  platforms,
  alreadySubmitted,
  challengeTitle,
}: {
  /** Platforms the creator registered. */
  platforms: CampaignPlatform[];
  /** Platforms already used for the open challenge. */
  alreadySubmitted: string[];
  challengeTitle: string;
}) {
  const router = useRouter();
  const available = platforms.filter((p) => !alreadySubmitted.includes(p));

  const [platform, setPlatform] = useState<string>(available[0] ?? "");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<{ field?: string; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  if (available.length === 0) {
    return (
      <p className="max-w-prose text-sm leading-relaxed text-white/60">
        You have submitted on every account you registered for this challenge.
        Entries are reviewed before they score, and each platform is reviewed on
        its own.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/campaigns/monica/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, url }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        const message = result.message ?? "Something went wrong.";
        setError({ field: result.field, message });
        toast.error(message);
        if (result.field === "url") urlRef.current?.focus();
        return;
      }

      track("campaign_entry_submitted", { campaign: "monica-money-story" });
      toast.success(`Submitted for ${challengeTitle}`);
      setUrl("");
      // The server owns the list of what has been submitted, so refresh rather
      // than guessing the new state here and drifting from it.
      router.refresh();
    } catch {
      const message =
        "We could not reach the server. Check your connection and try again.";
      setError({ message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="platform"
          className="block text-sm font-semibold text-white"
        >
          Where you published it
        </label>
        <select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white focus:border-brand-gold focus:outline-none"
        >
          {available.map((p) => (
            <option key={p} value={p}>
              {platformLabels[p]}
            </option>
          ))}
        </select>
        {error?.field === "platform" && (
          <p role="alert" className="text-sm text-red-300">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="url" className="block text-sm font-semibold text-white">
          Link to your post
        </label>
        <p className="text-sm text-white/50">
          The public link, the way you would send it to a friend.
        </p>
        <input
          id="url"
          ref={urlRef}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          inputMode="url"
          placeholder="https://"
          className="w-full rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
        />
        {error?.field === "url" && (
          <p role="alert" className="text-sm text-red-300">
            {error.message}
          </p>
        )}
      </div>

      {error && !error.field && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !url.trim()}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
      >
        {submitting ? "Submitting..." : "Submit this entry"}
        {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>
    </form>
  );
}
