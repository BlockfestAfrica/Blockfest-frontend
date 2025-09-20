import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { agendaItems } from "@/lib/schedule";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});


export function Agenda() {
  return (
    <Accordion
      type="single"
      collapsible
      className={`${montserrat.className} w-full `}
    // defaultValue="item-1"
    >
      {agendaItems.map((item, index) => (
        <AccordionItem
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          key={index}
          value={`item-${index + 1}`}
          className="border-b"
        >
          <AccordionTrigger className="flex justify-between  items-center py-4">
            <div className="flex md:items-center md:flex-row flex-col w-[80%] justify-between gap-y-3 ">
              <p className="text-[15px] md:text-2xl font-medium text-left">
                {item.time}
              </p>
              <div className="flex flex-col  w-full xl:w-[50%] lg:w-[60%] md:w-[55%] ">
                <p className="text-2xl md:text-[30px] lg:text-[35px] xl:text-[40px] font-semibold text-[#0051FF] ">
                  {item.title}
                </p>
                {/* Speaker if available*/}
                {item.speaker && (
                  <p className="text-sm md:text-base text-[#000000] font-semibold ">
                    Presented by {item.speaker}
                  </p>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2 text-[#000]">
            {item.description.map((desc, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <p key={i}>{desc}</p>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
