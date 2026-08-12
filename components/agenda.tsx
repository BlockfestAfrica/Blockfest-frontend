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
  keynote: "bg-brand-blue/10 text-brand-blue",
  address: "bg-brand-blue/10 text-brand-blue",
  panel: "bg-brand-blue/10 text-brand-blue",
  fireside: "bg-brand-blue/10 text-brand-blue",
  talk: "bg-brand-blue/10 text-brand-blue",
  lecture: "bg-brand-blue/10 text-brand-blue",
  workshop: "bg-brand-blue/10 text-brand-blue",
  pitch: "bg-brand-blue/10 text-brand-blue",
  break: "border border-gray-200 bg-paper-muted text-gray-600",
  networking: "border border-gray-200 bg-paper-muted text-gray-600",
  "wrap-up": "border border-gray-200 bg-paper-muted text-gray-600",
  performance: "bg-brand-blue/10 text-brand-blue",
  activity: "bg-brand-blue/10 text-brand-blue",
  sponsor: "border border-gray-200 bg-paper-muted text-gray-600",
  partner: "border border-gray-200 bg-paper-muted text-gray-600",
  default: "border border-gray-200 bg-paper-muted text-gray-600",
};

export function Agenda() {
  return (
    <section aria-labelledby="schedule-heading" className="w-full">
      <Accordion
        type="single"
        collapsible
        className={`${gotham.className} w-full space-y-4`}
      >
        {agendaItems.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="rounded-xl border border-gray-200 bg-white transition-colors duration-300 last:border-b hover:border-brand-blue"
          >
            <AccordionTrigger className="group flex cursor-pointer items-start justify-between gap-4 rounded-xl p-6 text-left transition-colors hover:no-underline [&>svg]:text-gray-500">
              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                  <time
                    className="w-fit shrink-0 rounded-full border border-gray-200 bg-paper-muted px-3 py-1 text-xs font-semibold tabular-nums text-gray-900"
                    dateTime={item.time.replace(/\s/g, "")}
                  >
                    {item.time}
                  </time>
                  <span className="flex-1 text-lg font-bold leading-tight text-gray-900 transition-colors duration-300 group-hover:text-brand-blue">
                    {item.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {item.speaker && (
                    <p className="text-sm text-gray-600">
                      Presented by{" "}
                      <span className="font-semibold text-gray-900">
                        {item.speaker}
                      </span>
                    </p>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${typeStyles[item.type] ?? typeStyles.default}`}
                  >
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                  {item.duration && (
                    <span className="text-xs font-medium tabular-nums text-gray-500">
                      {item.duration} min
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-3 border-t border-gray-200 pt-5">
                {item.description.map((desc, i) => (
                  <p
                    key={`${item.id}-desc-${i}`}
                    className="text-base leading-relaxed text-gray-600"
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
