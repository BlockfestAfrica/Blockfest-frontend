import {
  MONICA_CAMPAIGN_DAYS,
  MONICA_FIRST_LEADERBOARD,
  monicaStages,
} from "@/lib/campaigns";

/**
 * The campaign, stage by stage.
 *
 * Also where the leaderboard would go. On day one nobody has a point, and the
 * first standings are eight days out, so this states the date instead. A table
 * of zeroes reads as a broken feature; a dated promise reads as a schedule.
 */
export function MonicaStages() {
  return (
    // Anchored, because the success screen sends a creator straight here.
    // "See the first challenge" landing at the top of the page and leaving
    // them to scroll for it is the same as not linking to it.
    <section
      id="stages"
      className="section-y scroll-mt-20 border-t border-white/20 bg-ground"
    >
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">
          The {MONICA_CAMPAIGN_DAYS}-day journey
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Four stages, each with its own question. The briefs get harder and the
          creative freedom gets wider.
        </p>

        <ol className="mt-12 flex flex-col gap-4">
          {monicaStages.map((stage) => (
            <li
              key={stage.number}
              className="rounded-xl border border-white/20 bg-white/5 p-6 sm:p-8"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                <div className="md:w-40 md:shrink-0">
                  <p className="eyebrow text-brand-gold">
                    Stage {stage.number}
                  </p>
                  <p className="mt-1.5 text-sm tabular-nums text-white/60">
                    Days {stage.days[0]} to {stage.days[1]}
                  </p>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{stage.name}</h3>
                  <p className="mt-1 text-base font-semibold text-white/80">
                    {stage.question}
                  </p>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
                    {stage.focus}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {stage.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/60"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-xl border border-dashed border-white/20 p-6 sm:p-8">
          <p className="eyebrow text-white/60">Leaderboard</p>
          <p className="mt-2 text-lg font-semibold text-white">
            First standings: {MONICA_FIRST_LEADERBOARD}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
            Standings update every Saturday once entries have been reviewed.
            Weekly winners are announced on Sundays.
          </p>
        </div>
      </div>
    </section>
  );
}
