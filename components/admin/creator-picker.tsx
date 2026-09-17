"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { control } from "@/components/shared/panel";

export interface PickerCandidate {
  enrolmentId: string;
  name: string;
  points: number;
  rank: number;
}

/** Rows shown before the list asks the admin to keep typing. */
const VISIBLE = 8;

const rowLabel = (c: PickerCandidate) =>
  `${c.rank}. ${c.name} (${c.points} points)`;

/**
 * A creator dropdown that survives a long campaign.
 *
 * The announce card used a native select, which was fine with ten names and
 * is not fine with three hundred: a Sunday-night owner scrolling an OS-drawn
 * option list for one person is how the wrong row gets clicked. This is the
 * same field as a combobox: type any part of a name, pick from the matches.
 * The input doubles as the display, so a chosen creator reads back exactly
 * as the old option text did, and focusing again starts a fresh search
 * without losing the choice until a new one is made.
 *
 * The open list sits in the flow of the card rather than floating over it:
 * JobCard clips overflowing children to its rounded corners, so an absolute
 * dropdown lost its bottom rows to the card edge exactly when the list was
 * long enough to matter. Pushing the fields below down while searching is
 * the honest trade, and it cannot be clipped on any viewport.
 */
export function CreatorPicker({
  id,
  candidates,
  value,
  onChange,
  placeholder = "Type a name to search…",
}: {
  id: string;
  candidates: PickerCandidate[];
  value: string;
  onChange: (enrolmentId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${id}-options`;

  const selected = candidates.find((c) => c.enrolmentId === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, query]);

  const shown = matches.slice(0, VISIBLE);
  const hidden = matches.length - shown.length;
  const activeId =
    open && shown[active] ? `${listId}-${shown[active].enrolmentId}` : undefined;

  /* The list scrolls internally past ~7 rows and DOM focus never leaves the
     input, so the highlighted row must be brought into view by hand or the
     keyboard selects rows the admin cannot see. */
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function pick(candidate: PickerCandidate) {
    onChange(candidate.enrolmentId);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      setActive(0);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (event.key === "Escape") {
      /* Blurring, not just closing: a closed-but-focused input would show
         the selected label as live editable text, and the next keystroke
         would search for "1. Amara Obi (500 points)b". */
      inputRef.current?.blur();
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        className={control}
        placeholder={placeholder}
        value={open ? query : selected ? rowLabel(selected) : query}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching creators"
          /* Mouse down anywhere on the list, its padding, or its scrollbar
             must not blur the input: blur closes the list mid-scroll and
             wipes the typed query. Options act on mousedown too, so
             suppressing the default costs nothing. */
          onMouseDown={(event) => event.preventDefault()}
          className="mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-line-2 bg-card-2 py-1"
        >
          {shown.map((candidate, index) => (
            <li
              key={candidate.enrolmentId}
              id={`${listId}-${candidate.enrolmentId}`}
              role="option"
              aria-selected={candidate.enrolmentId === value}
              onMouseDown={() => pick(candidate)}
              onMouseEnter={() => setActive(index)}
              className={`flex min-h-11 w-full cursor-pointer items-baseline gap-2 px-4 py-3 text-left text-sm transition-colors ${
                index === active ? "bg-card-3 text-white" : "text-ink"
              }`}
            >
              <span className="shrink-0 tabular-nums text-ink-3">
                {candidate.rank}.
              </span>
              <span className="font-semibold">{candidate.name}</span>
              <span className="ml-auto shrink-0 tabular-nums text-ink-3">
                {candidate.points} points
              </span>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-2">
              No creator matches &ldquo;{query.trim()}&rdquo;.
            </li>
          )}
          {hidden > 0 && (
            <li className="border-t border-line px-4 py-2 text-sm text-ink-3">
              {hidden} more {hidden === 1 ? "match" : "matches"}. Keep typing
              to narrow it.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
