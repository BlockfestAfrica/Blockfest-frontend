import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { agendaItems } from "@/lib/schedule";
import { gotham } from "@/lib/fonts";

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
            className="relative border border-gray-200 rounded-xl bg-gradient-to-r from-white to-gray-50 hover:from-[#005DFF]/5 hover:to-brand-blue/5 hover:border-brand-blue-light hover:shadow-lg transition-all duration-300 cursor-pointer"
          >
            <AccordionTrigger className="flex justify-between items-start py-4 md:py-6 px-4 md:px-6 hover:no-underline group rounded-xl active:scale-[0.98] transition-transform duration-150">
              <div className="flex flex-col w-full gap-3 text-left pr-4 md:pr-8">
                <div className="flex gap-3 md:flex-row flex-col md:items-center md:gap-3">
                  <time
                    className="text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-brand-blue-light to-brand-blue-light-hover px-3 py-1.5 rounded-full whitespace-nowrap shadow-md group-hover:shadow-lg transition-all duration-300 flex-shrink-0 w-fit"
                    dateTime={item.time.replace(/\s/g, "")}
                  >
                    {item.time}
                  </time>
                  <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-brand-blue-light group-hover:text-brand-blue transition-colors duration-300 leading-tight flex-1">
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
                      className={`text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm flex-shrink-0 ${
                        item.type === "keynote"
                          ? "bg-gradient-to-r from-brand-blue-light to-brand-blue-light-hover text-white"
                          : item.type === "panel"
                          ? "bg-gradient-to-r from-brand-blue to-brand-blue-hover text-white"
                          : item.type === "talk"
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                          : item.type === "sponsor"
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                          : item.type === "activity"
                          ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white"
                          : item.type === "pitch"
                          ? "bg-gradient-to-r from-teal-500 to-teal-600 text-white"
                          : item.type === "performance"
                          ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white"
                          : item.type === "fireside"
                          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"
                          : item.type === "networking"
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                          : item.type === "break"
                          ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white"
                          : item.type === "address"
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                          : item.type === "partner"
                          ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"
                          : item.type === "wrap-up"
                          ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white"
                          : "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
                      }`}
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
              <div className="space-y-3 sm:space-y-4 text-gray-700 leading-relaxed bg-gradient-to-r from-brand-blue-light/5 to-brand-blue-light-hover/5 p-3 sm:p-4 md:p-6 rounded-lg border-l-4 border-brand-blue-light">
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
