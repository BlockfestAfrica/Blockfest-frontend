import { monicaHowItWorks } from "@/lib/campaigns";

/**
 * The loop, then what is being judged.
 *
 * These sit together because they answer the same worry in sequence: what am I
 * actually being asked to do, and what will it be measured against. Splitting
 * them across the page left the second question hanging.
 */
export function MonicaHowItWorks() {
  return (
    <section className="section-y border-t border-line-2 bg-ground">
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">How it works</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
          A new brief every Monday, your own take on it, published on your own
          account. Repeat across all stages.
        </p>

        {/* 2x2, not four across: inside container-page four columns give a
            ~200px prose measure and the steps are full sentences. */}
        <ol className="mt-12 grid gap-6 sm:grid-cols-2">
          {monicaHowItWorks.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-line-2 bg-card-2 p-6"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-bold tabular-nums text-brand-gold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-3">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        
      </div>
    </section>
  );
}
