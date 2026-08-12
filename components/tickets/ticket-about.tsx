import { ticketPillars } from "@/lib/tickets";

export function TicketAbout() {
  return (
    <section
      id="about-2026"
      className="section-y bg-ground border-t border-white/20"
    >
      <div className="container-page">
        <div className="mb-10 max-w-2xl lg:mb-14">
          <h2 className="text-display-sm font-bold text-white">
            The Super Bowl of African Innovation
          </h2>

          <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-white/60">
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
        </div>

        <p className="eyebrow text-white/60">Built for people who want to</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ticketPillars.map((pillar) => (
            <div
              key={pillar.word}
              className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
            >
              <p className="text-lg font-bold text-white">{pillar.word}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
