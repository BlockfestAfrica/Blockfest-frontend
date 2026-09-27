"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A winner's note as a quiet line: two lines at most until asked for more.
 *
 * The whole text is always in the DOM, so a screen reader reads all of it;
 * "More" only appears when the clamp actually hides something, which is
 * measured rather than guessed from the length, since the width decides it.
 * The toggle names whose note it opens, so several on one page are told
 * apart ("More about Adinnu Lucy"), with the visible word first.
 */
export function NoteLine({ id, text, name }: { id: string; text: string; name: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    // Older in-app browsers lack it; the first measure still stands.
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-2">
      <p
        ref={ref}
        id={id}
        className={`max-w-prose text-sm leading-relaxed text-ink-3 [overflow-wrap:anywhere] ${open ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="-mb-2 inline-flex min-h-11 min-w-11 cursor-pointer items-center text-sm font-semibold text-ink-2 transition-colors duration-150 hover:text-white"
        >
          {open ? "Less" : "More"}
          <span className="sr-only"> about {name}</span>
        </button>
      )}
    </div>
  );
}
