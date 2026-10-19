"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import type { Room } from "@/lib/run-of-show-layout";

const BOTH = "both";
const Picked = createContext<string>(BOTH);

/**
 * The workshop day's room filter, and the slots it narrows.
 *
 * Native radio buttons, so the arrow keys move between rooms and Tab enters
 * the group once. "Two rooms run at the same time" is said here and nowhere
 * else on the day. The radios are visually hidden, so each label carries the
 * site's focus ring through `focus-ring-within` (globals.css), drawn inside
 * because the group's rounded edge clips anything outside.
 * Without JavaScript the <noscript> style in run-of-show.tsx removes the
 * filter and every room shows.
 */
export function RoomScope({
  rooms,
  from,
  children,
}: {
  rooms: Room[];
  /** When the rooms split, "10:40". */
  from: string;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState(BOTH);
  const name = useId();
  const options = [{ key: BOTH, number: "Both rooms", name: "" }, ...rooms];

  return (
    <Picked.Provider value={picked}>
      <fieldset data-schedule-js className="mt-6">
        <legend className="text-sm text-gray-600">
          From {from}, two rooms run at the same time.
          <span className="sr-only"> Show the sessions in:</span>
        </legend>
        <div className="mt-2 flex divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white sm:max-w-xl">
          {options.map((option) => {
            const on = picked === option.key;
            return (
              <label
                key={option.key}
                className={`relative flex min-h-12 min-w-0 flex-1 basis-0 cursor-pointer flex-col justify-center px-2.5 py-2 transition-colors duration-150 focus-ring-within sm:px-4 ${
                  on ? "text-gray-900" : "text-gray-500 hover:bg-paper-muted hover:text-gray-900"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.key}
                  checked={on}
                  onChange={() => setPicked(option.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold leading-tight">{option.number}</span>
                {option.name && <span className="mt-0.5 text-xs leading-tight">{option.name}</span>}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-0.5 ${on ? "bg-brand-blue" : "bg-transparent"}`}
                />
              </label>
            );
          })}
        </div>
      </fieldset>
      {children}
    </Picked.Provider>
  );
}

/**
 * A two-room slot: side by side from md, stacked on a phone, or only the
 * picked room. The other room's session stays in the DOM, hidden.
 */
export function SplitTracks({ tracks }: { tracks: { room: string; node: ReactNode }[] }) {
  const picked = useContext(Picked);
  const both = picked === BOTH || !tracks.some((track) => track.room === picked);

  return (
    <ul
      className={
        both
          ? "mt-2 divide-y divide-gray-200 md:grid md:grid-cols-2 md:divide-x md:divide-y-0"
          : "mt-2"
      }
    >
      {tracks.map((track) => (
        <li
          key={track.room}
          hidden={!both && track.room !== picked}
          className={both ? "py-3 first:pt-0 last:pb-0 md:px-5 md:py-0 md:first:pl-0 md:last:pr-0" : undefined}
        >
          {track.node}
        </li>
      ))}
    </ul>
  );
}
