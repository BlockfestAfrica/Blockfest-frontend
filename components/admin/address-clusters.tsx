"use client";

import { useState } from "react";
import { Pill } from "@/components/shared/panel";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface AddressClusterRow {
  ip: string;
  creators: number;
  names: string[];
}

/**
 * Registrations sharing an address, ten clusters at a time.
 *
 * The query stops at fifty clusters and sorts the biggest first, and on
 * carrier-grade networks most of them are innocent, so a full render buries
 * the two or three worth a human look under a page of noise. Reveal keeps
 * the ones most worth that look on the first screen.
 */
export function AddressClusters({
  clusters,
}: {
  clusters: AddressClusterRow[];
}) {
  const [visible, setVisible] = useState(PAGE);
  const shown = clusters.slice(0, visible);

  return (
    <>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
        {shown.map((cluster) => (
          <li key={cluster.ip} className="p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-sm text-ink-2">
                {cluster.ip}
              </span>
              <Pill tone="bad">{cluster.creators} creators</Pill>
            </div>
            <p className="mt-1 text-sm text-ink-3">
              {cluster.names.join(", ")}
            </p>
          </li>
        ))}
      </ul>
      {clusters.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({clusters.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">
          Showing all {clusters.length} shared addresses.
        </p>
      )}
    </>
  );
}
