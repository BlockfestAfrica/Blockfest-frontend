import { CONTACT_EMAIL } from "@/lib/constants";
import {
  EARLY_BIRD_ENDS,
  PHOTOGRAPHY_NOTICE,
  TRANSFER_DEADLINE,
} from "@/lib/tickets";
import { TicketCTA } from "./ticket-cta";

export function TicketPolicy() {
  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
            <h2 className="text-lg font-bold text-white lg:text-2xl">
              Ticket Policy
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-white/60 lg:text-base">
              <p>
                <span className="font-semibold text-white">
                  BLOCKF3ST AFRICA™
                </span>{" "}
                convention tickets are{" "}
                <span className="font-semibold text-white">non-refundable</span>
                . They are transferable until{" "}
                <span className="font-semibold text-white">
                  {TRANSFER_DEADLINE.display}
                </span>
                .
              </p>
              <p>Refunds are not provided for no-shows.</p>
              <p>
                Early bird pricing ends{" "}
                <span className="font-semibold text-white">
                  {EARLY_BIRD_ENDS.display}
                </span>
                , after which passes revert to standard pricing. A small
                processing fee is added at checkout.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
            <h2 className="text-lg font-bold text-white lg:text-2xl">
              Photography &amp; Media Notice
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60 lg:text-base">
              {PHOTOGRAPHY_NOTICE} If you have any concerns, please contact us
              at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex min-h-11 items-center text-brand-blue-light underline underline-offset-2 hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>

        <div className="mt-14 max-w-2xl lg:mt-20">
          <h2 className="text-display-sm font-bold text-white">
            Lagos, October 2026.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Early bird pricing runs until {EARLY_BIRD_ENDS.display}.
          </p>
          <div className="mt-8">
            <TicketCTA source="Tickets Page - Footer CTA" className="px-8">
              Secure your seat
            </TicketCTA>
          </div>
        </div>
      </div>
    </section>
  );
}
