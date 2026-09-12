import { monicaHowItWorks, monicaSkills } from "@/lib/campaigns";

/**
 * The loop, then what is being judged.
 *
 * These sit together because they answer the same worry in sequence: what am I
 * actually being asked to do, and what will it be measured against. Splitting
 * them across the page left the second question hanging.
 */
export function MonicaHowItWorks() {
  return (
    <section className="section-y border-t border-white/20 bg-ground">
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">How it works</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          A new brief every Monday, your own take on it, published on your own
          account. Repeat for four weeks.
        </p>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {monicaHowItWorks.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-white/20 bg-white/5 p-6"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-bold tabular-nums text-brand-gold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-16">
          <h3 className="text-display-sm font-bold text-white">
            Four skills, tested
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            The ranking is not a view count. Entries are weighed on all four,
            which is how a smaller account with a better idea beats a bigger one
            without.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {monicaSkills.map((skill) => (
              <div
                key={skill.name}
                className="rounded-xl border border-white/20 bg-white/5 p-5"
              >
                <h4 className="eyebrow text-brand-gold">{skill.name}</h4>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {skill.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
