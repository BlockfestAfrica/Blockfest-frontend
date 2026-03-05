"use client";
import Link from "next/link";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { useUmami } from "@/lib/hooks/use-umami";
import { FaTelegram, FaEnvelope } from "react-icons/fa";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";

export function SponsorshipSection() {
  const { trackButtonClick } = useUmami();

  useSubtleAnimations();

  const contactEmail = CONTACT_EMAIL;

  return (
    <section
      className="py-12 lg:py-16 bg-gradient-to-b from-brand-blue-deep to-black relative overflow-hidden"
      id="sponsorship"
    >
      <div className="relative z-10 max-w-3xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 lg:mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-4 border border-white/20">
            <span className="text-brand-gold font-semibold text-sm">
              PARTNERSHIP OPPORTUNITIES
            </span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4 fade-in-on-scroll">
            Become a <span className="text-brand-gold">Sponsor</span>
          </h2>
          <p className="text-white/70 text-base lg:text-lg max-w-3xl mx-auto fade-in-on-scroll">
            Position your brand at Africa&apos;s premier Web3 event. Reach over{" "}
            <span className="font-semibold text-brand-gold">200 million+</span>{" "}
            potential web3 users and connect with decision makers shaping the
            future of blockchain in Africa.
          </p>
        </div>

        {/* Contact CTA */}
        <div className="bg-gradient-to-br from-brand-blue to-brand-blue-dark rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-center scale-in border border-white/10">
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
            Get Our Sponsorship Deck
          </h3>
          <p className="text-white/80 mb-8 max-w-2xl mx-auto">
            Interested in sponsoring Blockf3st Africa 2026? Reach out to us and
            we&apos;ll share our comprehensive sponsorship deck with all
            available packages and benefits.
          </p>

          <div className="flex flex-col gap-4 justify-center items-center">
            <Link
              href={`mailto:${contactEmail}?subject=Sponsorship Inquiry - Blockf3st Africa 2026`}
              onClick={() =>
                trackButtonClick("Email Sponsorship", "Sponsorship Section")
              }
              className="inline-flex items-center gap-2 bg-brand-gold text-black px-5 py-3 rounded-full font-semibold hover:bg-brand-gold-hover transition-colors text-sm sm:text-base max-w-full"
            >
              <FaEnvelope className="flex-shrink-0" />
              <span className="truncate">{contactEmail}</span>
            </Link>
            <span className="text-white/60">or</span>
            <Link
              href="https://t.me/Olanetsoft"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackButtonClick("Telegram Sponsorship", "Sponsorship Section")
              }
              className="inline-flex items-center justify-center gap-2 bg-[#0088cc] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0077b5] transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <FaTelegram className="flex-shrink-0 text-lg" />
              <span>Message on Telegram</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
