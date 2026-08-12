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
    <section className="py-12 lg:py-16 bg-ground text-white">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <h2 className="text-3xl lg:text-5xl font-bold text-center mb-8 lg:mb-10">
          {title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="flex items-start gap-4 bg-white/10 rounded-xl p-4 lg:p-5 border border-white/20 hover:bg-white/20 transition-colors duration-300"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/20 text-brand-blue-light">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-white text-base font-medium leading-relaxed">
                {highlight}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
