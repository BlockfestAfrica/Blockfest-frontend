import { CONTACT_EMAIL } from "@/lib/constants";
import {
  EARLY_BIRD_ENDS,
  PHOTOGRAPHY_NOTICE,
  TRANSFER_DEADLINE,
} from "@/lib/tickets";
import { TicketCTA } from "./ticket-cta";

export function TicketPolicy() {
  return (
    <section className="relative bg-ground border-t border-white/20 py-14 lg:py-20">
      <div className="relative z-10 mx-auto max-w-4xl px-4 lg:px-8">
        <div className="rounded-xl border border-white/20 bg-white/5 p-6 lg:p-8">
          <h2 className="text-lg font-bold text-white lg:text-2xl">
            Ticket Policy
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-white/60 lg:text-base">
            <p>
              <span className="font-semibold text-white">
                BLOCKF3ST AFRICA™
              </span>{" "}
              convention tickets are{" "}
              <span className="font-semibold text-white">non-refundable</span>.
              They are transferable until{" "}
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

        <div className="mt-5 rounded-xl border border-white/20 bg-white/5 p-6 lg:p-8">
          <h2 className="text-lg font-bold text-white lg:text-2xl">
            Photography &amp; Media Notice
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60 lg:text-base">
            {PHOTOGRAPHY_NOTICE} If you have any concerns, please contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brand-blue-light underline underline-offset-2 hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>

        <div className="mt-12 text-center">
          <h2 className="mb-3 text-2xl font-bold text-white sm:text-3xl">
            Lagos, October 2026.
          </h2>
          <p className="mx-auto mb-7 max-w-xl text-base text-white/60">
            Early bird pricing runs until {EARLY_BIRD_ENDS.display}.
          </p>
          <TicketCTA source="Tickets Page - Footer CTA" className="px-8">
            Secure your seat
          </TicketCTA>
        </div>
      </div>
    </section>
  );
}
