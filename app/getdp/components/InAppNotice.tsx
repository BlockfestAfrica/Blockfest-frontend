"use client";

import { useState } from "react";
import { buttonClass } from "@/components/shared/panel";
import { COPY, chromeIntentUrl, inAppNotice, type ShareEnv } from "../lib/share";

/**
 * Above the steps, in a browser inside another app (Instagram, TikTok,
 * Facebook, LinkedIn): what may not work here and how to get out, before the
 * person has typed anything. A titled row on a line-3 edge, as every notice
 * on the site is. Nothing renders in a normal browser.
 */
export default function InAppNotice({ env }: { env: ShareEnv }) {
  const [result, setResult] = useState<string | null>(null);
  const copy = inAppNotice(env);
  if (!copy || typeof window === "undefined") return null;

  const { origin, host, href } = window.location;
  const link = `${origin}/getdp`;
  const copyLink = () => {
    const failed = () => setResult(COPY.copyThisLink(`${host}/getdp`));
    try {
      const p = navigator.clipboard?.writeText(link);
      if (!p) return failed();
      p.then(() => setResult(COPY.linkCopied(env)), failed);
    } catch {
      failed();
    }
  };

  return (
    <div
      role="note"
      aria-labelledby="dp-inapp-title"
      className="mb-6 rounded-xl border border-l-2 border-line-2 border-l-line-3 bg-card px-5 py-4 sm:px-6"
    >
      <p id="dp-inapp-title" className="font-semibold text-white">
        {copy.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        {/* The menu's own mark, set heavy: it is the thing to find on screen. */}
        {copy.body.split(/(⋮|•••)/).map((part, i) =>
          part === "⋮" || part === "•••" ? (
            <span key={i} className="font-bold text-white">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {copy.chrome && (
          <a href={chromeIntentUrl(href)} className={buttonClass("secondary", "w-full sm:w-auto")}>
            {COPY.openInChrome}
          </a>
        )}
        <button type="button" className={buttonClass("quiet", "w-full sm:w-auto")} onClick={copyLink}>
          {COPY.copyLink}
        </button>
      </div>
      <p aria-live="polite" className={result ? "mt-2 text-sm text-ink-2 [overflow-wrap:anywhere]" : "sr-only"}>
        {result}
      </p>
    </div>
  );
}
