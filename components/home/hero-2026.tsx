"use client";
import { IoCalendarClearOutline } from "react-icons/io5";
import { Button } from "../ui/button";
import Link from "next/link";
import { useUmami } from "@/lib/hooks/use-umami";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { blockfest2026Johannesburg, blockfest2026Lagos } from "@/lib/events";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";

interface EventCardProps {
  event: typeof blockfest2026Johannesburg;
  isPrimary?: boolean;
  onRegisterClick: () => void;
  contactEmail: string;
}

function EventCard({
  event,
  isPrimary = false,
  onRegisterClick,
  contactEmail,
}: EventCardProps) {
  const { trackButtonClick } = useUmami();
  const isJohannesburg = event.location.city === "Cape Town";
  const flagEmoji = isJohannesburg ? "🇿🇦" : "🇳🇬";

  return (
    <div
      className={`relative rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:scale-[1.02] ${
        isPrimary
          ? "bg-gradient-to-br from-brand-blue via-[#1554C7] to-[#0D3A8C] border-2 border-brand-gold"
          : "bg-gradient-to-br from-brand-gold/20 via-brand-blue/30 to-[#0D1F3C] border-2 border-brand-gold/50"
      }`}
    >
      {isPrimary && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-gold text-black text-xs font-bold px-4 py-1 rounded-full">
          NEXT EVENT
        </div>
      )}

      <div className="text-center">
        {/* Flag and Location */}
        <div className="text-4xl mb-3">{flagEmoji}</div>
        <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
          {event.location.city}
        </h3>
        <p className="text-white/70 text-sm mb-4">{event.location.country}</p>

        {/* Date */}
        <div className="flex items-center justify-center gap-2 text-brand-gold font-semibold mb-6">
          <IoCalendarClearOutline className="text-lg" />
          <span>{event.date.displayDate}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            className={`w-full font-semibold text-sm lg:text-base rounded-full py-5 ${
              isPrimary
                ? "bg-brand-gold text-black hover:bg-brand-gold-hover"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
            onClick={onRegisterClick}
            disabled={!event.registrationUrl}
          >
            {event.registrationUrl ? "Register Now" : "Coming Soon"}
          </Button>
          <Link href={`mailto:${contactEmail}`} passHref>
            <Button
              asChild
              className="w-full font-semibold text-sm lg:text-base rounded-full py-5 bg-transparent border border-white/30 text-white hover:bg-white/10"
              onClick={() => {
                trackButtonClick(
                  "Sponsor " + event.location.city,
                  "Hero Event Card"
                );
              }}
            >
              <span>Become a Sponsor</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HeroSection2026() {
  const { trackButtonClick, trackRegistration } = useUmami();
  const contactEmail = CONTACT_EMAIL;

  useSubtleAnimations();

  const handleJohannesburgRegister = () => {
    trackButtonClick("Register Now", "Hero Section - Cape Town");
    trackRegistration("hero-cta-cape-town");
    if (blockfest2026Johannesburg.registrationUrl) {
      window.open(
        blockfest2026Johannesburg.registrationUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleLagosRegister = () => {
    trackButtonClick("Register Now", "Hero Section - Lagos");
    trackRegistration("hero-cta-lagos");
    if (blockfest2026Lagos.registrationUrl) {
      window.open(
        blockfest2026Lagos.registrationUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <section className="relative w-full flex items-center justify-center bg-gradient-to-b from-[#000000] via-[#0A1628] to-[#0D1F3C] py-12 lg:py-16 overflow-hidden">
      {/* Grid pattern overlay - subtle dots */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
        {/* Main Content */}
        <div className="text-center mb-8 lg:mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-5 py-2.5 mb-6 border border-white/20 fade-in-on-scroll">
            <span className="text-brand-gold font-semibold text-sm lg:text-base">
              2026 AFRICA TOUR
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 scale-in">
            Blockf<span className="text-brand-blue">3</span>st Africa{" "}
            <span className="text-brand-gold">&apos;26</span>
          </h1>

          {/* Tagline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-white/90 font-medium mb-4 lg:mb-6 fade-in-on-scroll">
            Web3 In Motion —{" "}
            <span className="text-brand-gold">From Pipelines to Platforms</span>
          </p>

          {/* Description */}
          <p className="text-white/60 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto mb-6 lg:mb-8 fade-in-on-scroll">
            The singular event your brand needs to reach the eager African
            audience of over{" "}
            <span className="text-white font-semibold">200 million+</span> web3
            users of tomorrow. Join us in{" "}
            <span className="text-brand-gold">South Africa</span> and{" "}
            <span className="text-brand-gold">Nigeria</span> for Africa&apos;s
            biggest Web3 festival.
          </p>
        </div>

        {/* Dual Event Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 max-w-4xl mx-auto slide-in-right">
          <EventCard
            event={blockfest2026Johannesburg}
            isPrimary={true}
            onRegisterClick={handleJohannesburgRegister}
            contactEmail={contactEmail}
          />
          <EventCard
            event={blockfest2026Lagos}
            isPrimary={false}
            onRegisterClick={handleLagosRegister}
            contactEmail={contactEmail}
          />
        </div>

        {/* 2025 Recap Link */}
        <div className="text-center mt-8">
          <Link
            href="/blockfest-2025"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm lg:text-base"
          >
            <span>✨</span>
            <span>Missed 2025? See what happened in Lagos</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
