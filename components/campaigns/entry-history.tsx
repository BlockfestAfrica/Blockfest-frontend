"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { buttonClass } from "@/components/shared/panel";
import { returnFocus } from "@/components/shared/reveal";
import { byPlatform, MarkLink, platformLabel } from "@/components/shared/platform-marks";
import { TakeBackPanel, useWithdraw } from "@/components/campaigns/take-back";
import { entryState } from "@/components/campaigns/week-rows";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface EntryRow {
  id: string;
  weekNo: number;
  challengeTitle: string;
  platform: string;
  status: string;
  url: string;
  reviewNote: string | null;
}

/**
 * Everything a creator sent in weeks other than the open one, ten entries at
 * a time, grouped by week as rows of the section's one card.
 *
 * The week is said once, on its group's row, not on every post. The post is
 * its platform mark, a link named for screen readers, instead of a raw URL
 * that clipped on phones; it stays tappable because the commonest rejection
 * is a post that cannot be viewed at the link given, and on a phone there is
 * no other way to check that. Where it stands is the lead line and the row's
 * left edge.
 */
export function EntryHistory({
  entries,
  openWeekKnown,
}: {
  entries: EntryRow[];
  /** The open week was read, so every week listed here is known to be
      closed. When that read failed, the open week can be among them, and
      its entry must not be called closed. */
  openWeekKnown: boolean;
}) {
  const [visible, setVisible] = useState(PAGE);
  const [asking, setAsking] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  /* The row whose question is open. One is open at a time and a take back
     holds the rest, so it is also the row any request came from. */
  const origin = useRef<HTMLElement | null>(null);
  /* Never resendable from here: these are weeks other than the open one,
     so taking one back cannot free anything to send again. */
  const { busy, withdraw } = useWithdraw({
    canResend: false,
    onDone: (id) => {
      // Its own question only, never one opened since.
      setAsking((a) => (a === id ? null : a));
      setBack(id);
    },
  });
  const shown = entries.slice(0, visible);
  const weeks = [...new Set(shown.map((e) => e.weekNo))];

  // Focus goes back to Take back when its question is cancelled, or once
  // the take back succeeds, unless the creator has moved on elsewhere
  // meanwhile (returnFocus). A failure keeps the question, and focus goes
  // back to the button that was pressed (useWithdraw).
  useEffect(() => {
    if (!back || asking === back) return;
    returnFocus(document.getElementById(`entry-action-${back}`), origin.current);
    setBack(null);
  }, [back, asking]);

  return (
    <>
      <ul className="divide-y divide-line border-t border-line">
        {weeks.map((week) => {
          const inWeek = byPlatform(
            shown.filter((e) => e.weekNo === week),
            (e) => e.platform,
          );
          const title = inWeek[0]?.challengeTitle;
          return (
            <Fragment key={week}>
              <li className="px-4 pb-2 pt-3 sm:px-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4">
                  Week {week}
                  {title ? ` · ${title}` : ""}
                </h3>
              </li>
              {inWeek.map((entry) => {
                const label = platformLabel(entry.platform);
                const state = entryState(entry.status);
                const isAsking = asking === entry.id;
                const edge = isAsking ? "border-l-brand-gold bg-card-2" : state.edge;
                return (
                  <li
                    key={entry.id}
                    className={`border-l-2 px-4 py-3 transition-colors duration-150 sm:px-5 ${edge}`}
                  >
                    <div className="flex items-center gap-3">
                      <MarkLink
                        platform={entry.platform}
                        url={entry.url}
                        label={`Your ${label} post for week ${entry.weekNo}`}
                      />
                      <p
                        className={`inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold ${state.tone}`}
                      >
                        <span className="sr-only">{label}: </span>
                        {entry.status === "approved" && (
                          <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        {state.label}
                      </p>
                      {/* Only while nobody has ruled on it. An approved entry
                          has points minted against it and a rejected one is a
                          reviewer's recorded judgement; neither is a
                          creator's to erase, and the engine refuses both. */}
                      {entry.status === "pending" && (
                        <div className="shrink-0">
                          {isAsking ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setAsking(null);
                                setBack(entry.id);
                              }}
                              aria-expanded
                              aria-controls={`take-back-${entry.id}`}
                              className={buttonClass("quiet", "min-w-24")}
                            >
                              Cancel
                            </button>
                          ) : (
                            <button
                              id={`entry-action-${entry.id}`}
                              type="button"
                              disabled={busy !== null}
                              onClick={(event) => {
                                origin.current = event.currentTarget.closest("li");
                                setAsking(entry.id);
                              }}
                              aria-label={`Take back your ${label} post for week ${entry.weekNo}`}
                              aria-expanded={false}
                              aria-controls={`take-back-${entry.id}`}
                              className={buttonClass("quiet", "min-w-24")}
                            >
                              Take back
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {entry.reviewNote && (
                      <p className="mt-1 pl-14 text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                        {entry.reviewNote}
                      </p>
                    )}
                    {isAsking && (
                      <TakeBackPanel
                        id={entry.id}
                        platformLabel={label}
                        weekNo={entry.weekNo}
                        canResend={false}
                        weekClosed={openWeekKnown}
                        busy={busy === entry.id}
                        onWithdraw={(wasNotMe, pressed) => withdraw(entry.id, wasNotMe, pressed)}
                      />
                    )}
                  </li>
                );
              })}
            </Fragment>
          );
        })}
      </ul>
      {entries.length > visible && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className={buttonClass("quiet", "w-full")}
          >
            Show more ({entries.length - visible} more)
          </button>
        </div>
      )}
    </>
  );
}
