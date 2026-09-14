"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Give a creator a new personal link.
 *
 * The link is shown once at registration and only its hash is kept, so somebody
 * who loses it is locked out and we cannot read it back to them. That is the
 * right trade and it needs an answer on this side, which until now it did not
 * have: the registration screen told people to write in, and there was nothing
 * here to do about it.
 *
 * The new link is shown once, here, to be passed on by whoever is handling the
 * request. Issuing it invalidates the old one, which is also how you take a
 * link back if it ended up somewhere it should not have.
 */
export function ReissueLink() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{
    name: string;
    link: string;
    emailed: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setIssued(null);

    try {
      const response = await fetch("/api/admin/creator-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      setIssued({
        name: result.name,
        link: result.link,
        emailed: Boolean(result.emailed),
      });
      setCopied(false);
      toast.success(`New link for ${result.name}`);
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-2xl">
      <form
        onSubmit={submit}
        noValidate
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="reissue-email" className="sr-only">
          The email they registered with
        </label>
        <input
          id="reissue-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="The email they registered with"
          className="w-full flex-1 rounded-lg border border-line-2 bg-control px-4 py-3 text-base text-white placeholder:text-ink-3 focus:border-brand-gold"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-2 px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-card-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : "Issue a new link"}
        </button>
      </form>

      {issued && (
        <div className="mt-4 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-4">
          <p className="text-sm font-semibold text-white">
            New link for {issued.name}. Shown once.
            {issued.emailed
              ? " Also emailed to the address they registered with."
              : " The email did not go, so this copy is the only one. Pass it on now."}
          </p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-3">
            Send it to them yourself. It is not emailed, and it cannot be shown
            again.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <code className="w-full min-w-0 flex-1 truncate rounded-lg border border-line-2 bg-ground px-4 py-3 text-sm text-white">
              {issued.link}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(issued.link);
                setCopied(true);
                toast.success("Copied");
              }}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-card-3"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
