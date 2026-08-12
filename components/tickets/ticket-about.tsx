import { ticketPillars } from "@/lib/tickets";

export function TicketAbout() {
  return (
    <section
      id="about-2026"
      className="relative bg-ground border-t border-white/20 py-14 lg:py-20"
    >
      <div className="relative z-10 mx-auto max-w-4xl px-4 lg:px-8">
        <h2 className="mb-6 text-center text-3xl font-bold text-white">
          The Super Bowl of African Innovation
        </h2>

        <div className="flex flex-col gap-5 text-base leading-relaxed text-white/60 lg:text-lg">
          <p>
            Join over{" "}
            <span className="font-semibold text-white">5,000 founders</span>,
            engineers, investors, creators, policymakers and emerging talent
            from across Africa and the diaspora for{" "}
            <span className="font-semibold text-white">three days</span> of
            building, networking and dealmaking.
          </p>
          <p>
            Talks, workshops, founder and investor sessions, startup showcases
            and career opportunities across AI, Web3, fintech, infrastructure,
            media and culture.
          </p>
        </div>

        <div className="mt-12">
          <p className="mb-6 text-center text-sm uppercase tracking-[0.2em] text-white/60">
            Built for people who want to
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ticketPillars.map((pillar) => (
              <div
                key={pillar.word}
                className="rounded-xl border border-white/20 bg-white/5 p-5 text-center"
              >
                <p className="text-lg font-bold text-white">
                  {pillar.word}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
