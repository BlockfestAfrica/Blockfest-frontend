"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { monicaRoutes } from "@/lib/campaigns";

interface LiveResource {
  section: string;
  title: string;
  body: string | null;
  url: string | null;
}

/** Rows shown before the reader asks for more. */
const PAGE = 10;

/**
 * Resources the team publishes without a deploy (#70).
 *
 * A client fetch on a static page: the pack keeps building as static, and an
 * edit in the console is live here within a minute. Everything renders as
 * text through React's escaping, which is the whole security model, and the
 * server refuses any URL that is not https, so the anchor below can never be
 * handed a javascript: href.
 *
 * Renders its shell even while empty, since the hero and the creator's own
 * page link straight to #resources: a link that lands on nothing teaches
 * people the link is broken, so the empty state is a promise instead of a
 * hole. It used to render nothing at all, which was the right call before
 * anything linked here and the wrong one after.
 *
 * Ten rows at a time, because the console can keep adding resources without
 * a deploy, so nothing bounds this list, and every extra row pushes whatever
 * follows it further down that same page.
 */
export function LiveResources() {
  const [rows, setRows] = useState<LiveResource[]>([]);
  const [visible, setVisible] = useState(PAGE);

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

  const shown = rows.slice(0, visible);

  return (
    <section
      id="resources"
      aria-labelledby="live-resources"
      className="mt-12 scroll-mt-20"
    >
      <h2 id="live-resources" className="text-xl font-bold text-white">
        Resources
      </h2>
      {rows.length === 0 && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
          Hashtags, handles, templates and anything else the team shares
          during the campaign lands here, alongside the{" "}
          <a
            href={monicaRoutes.pack}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-link underline underline-offset-2 hover:text-white"
          >
            Creator Pack
          </a>
          .
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((row) => (
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
      {rows.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({rows.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">
          Showing all {rows.length} resources.
        </p>
      )}
    </section>
  );
}
