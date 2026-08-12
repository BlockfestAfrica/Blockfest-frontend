import { idealAudience } from "@/lib/tickets";

export function IdealAudience() {
  return (
    <section
      id="who-its-for"
      className="relative bg-ground border-t border-white/20 py-14 lg:py-20"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white lg:text-5xl">
            Who It&apos;s For
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/60">
            The room is built for people shaping what Africa ships next.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {idealAudience.map((audience) => (
            <div
              key={audience.title}
              className="rounded-xl border border-white/20 bg-white/5 p-5 transition-colors duration-300 hover:bg-white/10"
            >
              <h3 className="text-base font-bold text-white lg:text-lg">
                {audience.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {audience.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
