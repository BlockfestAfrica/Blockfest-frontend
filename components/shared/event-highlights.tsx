// Shared highlights band used by the event recap pages.
export function EventHighlights({
  title = "Event Highlights",
  highlights,
}: {
  title?: string;
  highlights: string[];
}) {
  return (
    <section className="py-12 lg:py-16 bg-gradient-to-br from-brand-blue to-brand-blue-deep text-white">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <h2 className="text-3xl lg:text-5xl font-bold text-center mb-8 lg:mb-10">
          {title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="flex items-start gap-4 bg-white/10 rounded-xl p-4 lg:p-5 border border-white/10 hover:bg-white/[0.14] transition-all duration-300 group"
            >
              <div className="w-8 h-8 shrink-0 bg-brand-blue-light/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-brand-blue-light text-sm font-bold">✓</span>
              </div>
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
