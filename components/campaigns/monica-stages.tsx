"use client";

import { useEffect, useState } from "react";
import {
  MONICA_CAMPAIGN_DAYS,
  MONICA_FIRST_LEADERBOARD,
  monicaRoutes,
  monicaStages,
} from "@/lib/campaigns";
import { closingAt } from "@/lib/format";
import { LiveResources } from "./live-resources";

/** A started week, as the API publishes it. Drafts and future weeks never
    arrive here at all. */
interface LiveWeek {
  status: string;
  title: string;
  description: string;
  basePoints: number;
  endsAt: string;
}

/**
 * The campaign, stage by stage.
 *
 * Also where the leaderboard would go. On day one nobody has a point, and the
 * first standings are eight days out, so this states the date instead. A table
 * of zeroes reads as a broken feature; a dated promise reads as a schedule.
 */
export function MonicaStages() {
  /*
   * Live week statuses over the static schedule.
   *
   * The admin opens a week on Monday and closes it on Saturday, and this
   * page used to keep saying whatever was true at the last deploy. The
   * fetch follows the resources pattern: the page stays static, the API
   * returns only non-draft weeks, and nothing here renders until it
   * arrives, so the server HTML never disagrees with the first paint.
   */
  const [weeks, setWeeks] = useState<Record<number, LiveWeek>>({});
  /* Which briefs are unfolded, keyed by stage so two open weeks (a closed
     one and the live one) can be read side by side. */
  const [unfolded, setUnfolded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns/monica/challenges")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.challenges)) return;
        const map: Record<number, LiveWeek> = {};
        for (const row of data.challenges) {
          map[row.weekNo] = {
            status: String(row.status ?? ""),
            title: String(row.title ?? ""),
            description: String(row.description ?? ""),
            basePoints: Number(row.basePoints ?? 100),
            endsAt: String(row.endsAt ?? ""),
          };
        }
        setWeeks(map);
      })
      .catch(() => {
        // The static schedule carries the section.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // Anchored, because the success screen sends a creator straight here.
    // "See the first challenge" landing at the top of the page and leaving
    // them to scroll for it is the same as not linking to it.
    <section
      id="stages"
      className="section-y scroll-mt-20 border-t border-line-2 bg-ground"
    >
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">
          The {MONICA_CAMPAIGN_DAYS}-day journey
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          {monicaStages.length} stages, each with its own question. Stage 1 is
          published. The rest are revealed on the Monday they open.
        </p>

        <ol className="mt-12 flex flex-col gap-4">
          {monicaStages.map((stage) => {
            /*
             * Only the first stage is published.
             *
             * A creator who can read all five briefs on day one can write all
             * five in week one, which is the opposite of a campaign that builds.
             * Holding them back also means a brief can still be adjusted after
             * seeing what week one produced.
             *
             * Not rendered, rather than blurred with CSS. The campaigns index
             * makes the same point about its unnamed campaign: a blur leaves the
             * text in the markup and readable from view-source, which conceals
             * things only from people who do not look. What renders here is the
             * number, the dates and a bar the shape of a title, because the
             * schedule is not the secret; the brief is.
             */
            const week = weeks[stage.number];
            const status = week?.status;
            // A week the database has opened or closed is revealed even if
            // the deploy predates it; drafts never reach this component.
            const revealed = stage.number === 1 || Boolean(status);
            /* The full brief unfolds only for a week the database has
               started: the admin writes it in the console, and this is
               where a fresh registrant is sent to read what the week
               expects. */
            const brief = week?.description?.trim() ?? "";
            const isOpen = Boolean(unfolded[stage.number]);

            return (
              <li
                key={stage.number}
                /* The live week carries the same gold left edge the console's
                   JobCards use for their active state, so "what is happening
                   now" reads identically on both sides of the product. The
                   chip already says it in words; the edge says it at a
                   scroll-past glance. */
                className={`rounded-xl border p-6 sm:p-8 ${
                  status === "active"
                    ? "border-line-2 border-l-2 border-l-brand-gold bg-card-2"
                    : revealed
                      ? "border-line-2 bg-card-2"
                      : "border-dashed border-line-2"
                }`}
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                  <div className="md:w-40 md:shrink-0">
                    <p className="eyebrow text-brand-gold">
                      Stage {stage.number}
                    </p>
                    <p className="mt-1.5 text-sm tabular-nums text-ink-2">
                      Days {stage.days[0]} to {stage.days[1]}
                    </p>
                    {status === "active" && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 px-2.5 py-0.5 text-xs font-semibold text-brand-gold">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-brand-gold"
                          aria-hidden="true"
                        />
                        Open now
                      </p>
                    )}
                    {status === "closed" && (
                      <p className="mt-2 inline-flex items-center rounded-full border border-line-2 px-2.5 py-0.5 text-xs font-semibold text-ink-3">
                        Closed
                      </p>
                    )}
                  </div>

                  {revealed ? (
                    <div className="flex-1">
                      {/* The database title when the week has one, so an
                          admin's rename is live within the cache window
                          rather than waiting on a deploy of the registry. */}
                      <h3 className="text-xl font-bold text-white">
                        {week?.title || stage.name}
                      </h3>
                      <p className="mt-1 text-base font-semibold text-ink-2">
                        {stage.question}
                      </p>
                      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
                        {stage.focus}
                      </p>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {stage.skills.map((skill) => (
                          <li
                            key={skill}
                            className="rounded-full border border-line-2 px-3 py-1 text-xs font-semibold text-ink-2"
                          >
                            {skill}
                          </li>
                        ))}
                      </ul>

                      {brief && (
                        <>
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`stage-${stage.number}-brief`}
                            onClick={() =>
                              setUnfolded((state) => ({
                                ...state,
                                [stage.number]: !state[stage.number],
                              }))
                            }
                            className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:text-white"
                          >
                            {isOpen
                              ? "Hide the brief"
                              : "Read the full brief for this week"}
                            <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                          </button>

                          {isOpen && (
                            <div
                              id={`stage-${stage.number}-brief`}
                              className="mt-4 rounded-lg border border-line bg-ground p-5 sm:p-6"
                            >
                              {/* The brief as the admin wrote it, blank lines
                                  as paragraph breaks. Plain text in, plain
                                  text out: nothing here is markup. */}
                              {brief.split(/\n{2,}/).map((block, index) => (
                                <p
                                  key={index}
                                  className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-2 first:mt-0"
                                >
                                  {block}
                                </p>
                              ))}

                              <dl className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
                                <div className="flex flex-wrap gap-x-2">
                                  <dt className="font-semibold text-white">
                                    Points:
                                  </dt>
                                  <dd className="text-ink-2">
                                    +{week.basePoints} for completing the
                                    challenge, more through the wider point
                                    system.
                                  </dd>
                                </div>
                                {week.endsAt && (
                                  <div className="flex flex-wrap gap-x-2">
                                    <dt className="font-semibold text-white">
                                      Closes:
                                    </dt>
                                    <dd className="tabular-nums text-ink-2">
                                      {closingAt(week.endsAt)}, Lagos time.
                                    </dd>
                                  </div>
                                )}
                              </dl>

                              <p className="mt-4 text-sm text-ink-2">
                                Hashtags, handles and everything else you need
                                are in the{" "}
                                <a
                                  href={monicaRoutes.pack}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-link underline underline-offset-2 hover:text-white"
                                >
                                  Creator Pack
                                </a>
                                . The full point system lives in the{" "}
                                <a
                                  href={monicaRoutes.rules}
                                  className="text-link underline underline-offset-2 hover:text-white"
                                >
                                  rules
                                </a>
                                .
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1">
                      {/* Decorative, so it is hidden from screen readers and
                          the real message is given as text below it. */}
                      <div
                        className="flex select-none flex-col gap-3"
                        aria-hidden="true"
                      >
                        <span className="h-5 w-48 rounded-md bg-white/20 blur-[6px] sm:w-64" />
                        <span className="h-4 w-64 rounded-md bg-card-3 blur-[6px] sm:w-80" />
                      </div>
                      <p className="mt-5 text-sm leading-relaxed text-ink-3">
                        Revealed on the Monday it opens.
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* The pack page's resources, rehomed: published from the console,
            live within a minute, renders nothing while the list is empty. */}
        <LiveResources />

        <div className="mt-10 rounded-xl border border-dashed border-line-2 p-6 sm:p-8">
          <p className="eyebrow text-ink-3">Leaderboard</p>
          <p className="mt-2 text-lg font-semibold text-white">
            First standings: {MONICA_FIRST_LEADERBOARD}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
            The leaderboard moves as entries are approved. Weekly winners are
            announced on Sundays, and the Community Favourite vote runs on
            the winners page every Sunday.{" "}
            <a
              href="/campaigns/monica-money-story/winners#shortlist"
              className="text-link underline underline-offset-2 hover:text-white"
            >
              Winners and the vote
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
