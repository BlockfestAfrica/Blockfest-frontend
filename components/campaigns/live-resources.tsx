"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

interface LiveResource {
  section: string;
  title: string;
  body: string | null;
  url: string | null;
}

/**
 * Resources the team publishes without a deploy (#70).
 *
 * A client fetch on a static page: the pack keeps building as static, and an
 * edit in the console is live here within a minute. Everything renders as
 * text through React's escaping, which is the whole security model, and the
 * server refuses any URL that is not https, so the anchor below can never be
 * handed a javascript: href.
 *
 * Renders nothing at all until there is something to show: an empty heading
 * would read as a broken section on the page creators keep open all week.
 */
export function LiveResources() {
  const [rows, setRows] = useState<LiveResource[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns/monica/resources")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.resources)) setRows(data.resources);
      })
      .catch(() => {
        // The static pack content above carries the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="live-resources" className="mt-12">
      <h2 id="live-resources" className="text-xl font-bold text-white">
        From the team
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={`${row.section}-${row.title}`}
            className="rounded-xl border border-line bg-card p-4"
          >
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-11 items-center gap-1 font-semibold text-white underline-offset-4 hover:underline"
              >
                {row.title}
                <ArrowUpRight className="h-4 w-4 text-ink-4" aria-hidden="true" />
              </a>
            ) : (
              <p className="font-semibold text-white">{row.title}</p>
            )}
            {row.body && (
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                {row.body}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
