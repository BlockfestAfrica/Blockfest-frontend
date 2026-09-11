import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { monicaFaqs, monicaRoutes } from "@/lib/campaigns";

/**
 * The questions asked before entering.
 *
 * Everything here is answerable from the campaign brief. Anything turning on
 * legal wording, eligibility or how the money is actually paid is pushed to the
 * rules page rather than half-answered, because a wrong answer about
 * ₦5,000,000 is worse than a pointer to the page that governs it.
 */
export function MonicaFaq() {
  return (
    <section className="section-y border-t border-white/20 bg-ground">
      <div className="container-page">
        <h2 className="text-display-sm font-bold text-white">Questions</h2>

        <div className="mt-10 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {monicaFaqs.map((faq, i) => (
              <AccordionItem key={faq.question} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-white">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-white/60">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="mt-8 text-sm leading-relaxed text-white/60">
            Anything else is covered by the{" "}
            <Link
              href={monicaRoutes.rules}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              campaign rules
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
