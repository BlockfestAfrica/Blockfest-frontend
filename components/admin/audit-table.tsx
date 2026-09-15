"use client";

import { useMemo, useState } from "react";
import { Field, selectControl, control } from "@/components/shared/panel";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

/**
 * The action strings, as words a person filters by.
 *
 * The engine writes machine names; the reader thinks in decisions. Anything
 * not listed renders as its raw string rather than being hidden, so a new
 * action added in a migration appears here on its first row without a
 * deploy of this file.
 */
const ACTION_LABELS: Record<string, string> = {
  "submission.approved": "Entry approved",
  "submission.rejected": "Entry rejected",
  "points.awarded": "Points moved by hand",
  "winner.published": "Winner announced",
  "winner.drafted": "Winner drafted",
  "winner.draft_discarded": "Winner draft discarded",
  "leaderboard.snapshot": "Standings recorded",
  "entry.repriced": "Entry re-scored",
  "point_rule.updated": "Point rule changed",
  "challenge.updated": "Challenge edited",
  "campaign.paused": "Campaign paused",
  "campaign.resumed": "Campaign resumed",
  "campaign.purged": "Test data purged",
  "vote_round.opened": "Vote round opened",
  "vote_round.closed": "Vote round closed",
  "vote_round.reviewed": "Vote review completed",
  "vote.removed": "Vote removed",
  "vote.released": "Held vote released",
  "handle.corrected": "Handle corrected",
  "handle_request.approved": "Handle request approved",
  "handle_request.rejected": "Handle request rejected",
  "creator.link_reissued": "Personal link reissued",
  "resource.created": "Resource created",
  "resource.updated": "Resource edited",
  "resource.deleted": "Resource deleted",
  "payout.exported": "Payout CSV exported",
  "admin.signed_in": "Admin signed in",
  "admin.signed_out": "Admin signed out",
  "admin.identity_bound": "Admin identity bound",
  "admin.identity_mismatch": "Identity mismatch refused",
  "enrolment.voided": "Creator disqualified",
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;

export interface AuditTableRow {
  id: string;
  action: string;
  entityType: string;
  adminEmail: string | null;
  note: string | null;
  /** Pre-serialised, because jsonb shapes vary per action. Null when empty. */
  afterJson: string | null;
  /** Pre-formatted Lagos date, so this component never touches timezones. */
  dateLabel: string;
}

/**
 * Everything that happened, ten rows at a time, filterable.
 *
 * The trail existed from day one and was readable only with SQL, which
 * meant it answered questions nobody could ask. Three filters cover the
 * questions that actually get asked: what did this admin do, when did
 * anybody do this kind of thing, and what happened around this word. The
 * filters compose, and changing any of them resets the window so the
 * answer always starts from the most recent row.
 */
export function AuditTable({ rows }: { rows: AuditTableRow[] }) {
  const [action, setAction] = useState("");
  const [admin, setAdmin] = useState("");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const actions = useMemo(
    () => [...new Set(rows.map((r) => r.action))].sort(),
    [rows],
  );
  const admins = useMemo(
    () =>
      [...new Set(rows.map((r) => r.adminEmail ?? "system"))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (action && row.action !== action) return false;
      if (admin && (row.adminEmail ?? "system") !== admin) return false;
      if (q) {
        const hay =
          `${row.action} ${actionLabel(row.action)} ${row.adminEmail ?? ""} ${row.note ?? ""} ${row.entityType} ${row.afterJson ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, action, admin, query]);

  const shown = filtered.slice(0, visible);

  const refine = (set: () => void) => {
    set();
    setVisible(PAGE);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="audit-action" label="Action">
          <select
            id="audit-action"
            name="audit-action"
            value={action}
            onChange={(e) => refine(() => setAction(e.target.value))}
            className={selectControl}
          >
            <option value="">Every action</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="audit-admin" label="Admin">
          <select
            id="audit-admin"
            name="audit-admin"
            value={admin}
            onChange={(e) => refine(() => setAdmin(e.target.value))}
            className={selectControl}
          >
            <option value="">Everybody</option>
            {admins.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="audit-query"
          label="Contains"
          hint="Matches notes, names, and the recorded change."
        >
          <input
            id="audit-query"
            name="audit-query"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => refine(() => setQuery(e.target.value))}
            placeholder="reason, handle, amount…"
            className={control}
          />
        </Field>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
          >
            <span className="text-sm font-semibold text-white">
              {actionLabel(row.action)}
            </span>
            <span className="text-sm text-ink-3">
              {row.adminEmail ?? "system"}
            </span>
            <span className="ml-auto shrink-0 text-sm tabular-nums text-ink-3">
              {row.dateLabel}
            </span>
            {row.note && (
              <p className="w-full max-w-prose text-sm leading-relaxed text-ink-2">
                {row.note}
              </p>
            )}
            {row.afterJson && (
              <details className="w-full">
                <summary className="cursor-pointer text-sm text-ink-4 hover:text-ink-2">
                  What changed
                </summary>
                {/* Wide JSON scrolls inside itself; the page never scrolls
                    sideways. */}
                <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-card-2 p-3 text-xs leading-relaxed text-ink-2">
                  {row.afterJson}
                </pre>
              </details>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="p-4 text-sm text-ink-2">
            Nothing matches those filters. Loosen one and the trail comes
            back.
          </li>
        )}
      </ul>

      {filtered.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({filtered.length - visible} more)
        </button>
      ) : (
        filtered.length > 0 && (
          <p className="text-sm text-ink-4">
            Showing all {filtered.length}
            {filtered.length === rows.length
              ? " recorded actions."
              : ` matching actions of ${rows.length} recorded.`}
          </p>
        )
      )}
    </div>
  );
}
