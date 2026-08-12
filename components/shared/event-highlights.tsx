import { Check } from "lucide-react";

// Shared highlights band used by the event recap pages.
export function EventHighlights({
  title = "Event Highlights",
  highlights,
}: {
  title?: string;
  highlights: string[];
}) {
  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <h2 className="text-display-sm font-bold text-white">{title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Check className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-base font-medium leading-relaxed text-white/90">
                {highlight}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
