"use client";

import { useEffect, useState, type ReactNode } from "react";

/** setTimeout's ceiling; a deadline further out is checked again then. */
const LONGEST_WAIT = 2 ** 31 - 1;

/**
 * Its children until `at`, then nothing.
 *
 * For an action with a deadline on a cached page. The winners page is
 * rebuilt at most once a minute and a tab can stay open for days, so "Do
 * this now" would keep offering a vote whose own clock already said Closed.
 * The first render is always the children, as the server drew them, so the
 * page hydrates cleanly; the deadline is read only in the effect.
 */
export function ShownUntil({ at, children }: { at: string; children: ReactNode }) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const left = new Date(at).getTime() - Date.now();
      if (!(left > 0)) {
        setShown(false);
        return;
      }
      timer = setTimeout(check, Math.min(left + 1, LONGEST_WAIT));
    };
    check();
    return () => clearTimeout(timer);
  }, [at]);

  return shown ? <>{children}</> : null;
}
