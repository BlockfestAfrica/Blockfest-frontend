import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { agendaItems } from "@/lib/schedule";
import { gotham } from "@/lib/fonts";

/* Session types collapse to three roles rather than a colour each:
   programme content, scheduled pauses, and everything supporting. */
const typeStyles: Record<string, string> = {
  keynote: "bg-brand-blue text-white",
  address: "bg-brand-blue text-white",
  panel: "bg-brand-blue text-white",
  fireside: "bg-brand-blue text-white",
  talk: "bg-brand-blue text-white",
  lecture: "bg-brand-blue text-white",
  workshop: "bg-brand-blue text-white",
  pitch: "bg-brand-blue text-white",
  break: "bg-gray-100 text-gray-700",
  networking: "bg-gray-100 text-gray-700",
  "wrap-up": "bg-gray-100 text-gray-700",
  performance: "bg-brand-gold text-black",
  activity: "bg-brand-gold text-black",
  sponsor: "bg-gray-100 text-gray-700",
  partner: "bg-gray-100 text-gray-700",
  default: "bg-gray-100 text-gray-700",
};


export function Agenda() {
  return (
    <section aria-labelledby="schedule-heading" className="w-full">
      <Accordion
        type="single"
        collapsible
        className={`${gotham.className} w-full space-y-3 sm:space-y-4`}
      >
        {agendaItems.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="relative border border-gray-200 rounded-xl bg-white hover:border-brand-blue-light transition-colors duration-300 cursor-pointer"
          >
            <AccordionTrigger className="flex justify-between items-start py-4 md:py-6 px-4 md:px-6 hover:no-underline group rounded-xl active:scale-[0.98] transition-transform duration-150">
              <div className="flex flex-col w-full gap-3 text-left pr-4 md:pr-8">
                <div className="flex gap-3 md:flex-row flex-col md:items-center md:gap-3">
                  <time
                    className="text-xs sm:text-sm font-bold text-white bg-brand-blue px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 w-fit tabular-nums"
                    dateTime={item.time.replace(/\s/g, "")}
                  >
                    {item.time}
                  </time>
                  <h3 className="text-base sm:text-lg lg:text-2xl font-bold text-brand-blue-light group-hover:text-brand-blue transition-colors duration-300 leading-tight flex-1">
                    {item.title}
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  {item.speaker && (
                    <p className="text-xs sm:text-sm md:text-base text-gray-700 font-medium order-1">
                      Presented by{" "}
                      <span className="text-brand-blue font-bold">
                        {item.speaker}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 order-2">
                    <span
                      className={`text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex-shrink-0 ${typeStyles[item.type] ?? typeStyles.default}`}
                    >
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                    {item.duration && (
                      <span className="text-xs text-brand-blue-light font-semibold bg-brand-blue-light/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex-shrink-0">
                        {item.duration} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 sm:space-y-4 text-gray-700 leading-relaxed bg-paper-muted p-3 sm:p-4 md:p-6 rounded-md border-l-4 border-brand-blue-light">
                {item.description.map((desc, i) => (
                  <p
                    key={`${item.id}-desc-${i}`}
                    className="text-sm sm:text-base md:text-lg font-medium text-gray-800 leading-relaxed"
                  >
                    {desc}
                  </p>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
