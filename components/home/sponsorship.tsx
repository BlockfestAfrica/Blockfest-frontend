"use client";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { trackButtonClick } from "@/lib/sabilytics";
import { FaTelegram } from "react-icons/fa6";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";

export function SponsorshipSection() {

  useSubtleAnimations();

  const contactEmail = CONTACT_EMAIL;

  return (
    <section
      className="section-y bg-ground border-t border-white/20"
      id="sponsorship"
    >
      <div className="container-page">
        {/* Header */}
        <div className="mb-10 lg:mb-14 fade-in-on-scroll">
          <p className="eyebrow text-white/60">PARTNERSHIP OPPORTUNITIES</p>
          <h2 className="text-display-sm mt-3 font-bold text-white">
            Become a Sponsor
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Reach{" "}
            <span className="font-semibold text-white">
              15,000+ registered attendees
            </span>
            , decision makers, and founders across Africa.
          </p>
        </div>

        {/* Contact CTA */}
        <div className="rounded-xl border border-white/20 bg-white/5 p-6 scale-in lg:p-10">
          <h3 className="text-2xl font-bold text-white lg:text-3xl">
            Get Our Sponsorship Deck
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90">
            Email or message us and we&apos;ll send the Blockf3st Africa 2026
            deck with all packages and benefits.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href={`mailto:${contactEmail}?subject=Sponsorship Inquiry - Blockf3st Africa 2026`}
              onClick={() =>
                trackButtonClick("Email Sponsorship", "Sponsorship Section")
              }
              className="inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover sm:px-7 sm:text-base"
            >
              <Mail className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="break-all text-center">{contactEmail}</span>
            </Link>
            <span className="self-center text-sm text-white/60">or</span>
            <Link
              href="https://t.me/Olanetsoft"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackButtonClick("Telegram Sponsorship", "Sponsorship Section")
              }
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-7 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/20 sm:text-base"
            >
              <FaTelegram className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>Message on Telegram</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
