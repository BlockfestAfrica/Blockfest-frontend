"use client";
import Link from "next/link";
import { Button } from "../ui/button";
import React from "react";
import { trackButtonClick } from "@/lib/sabilytics";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";
import { LogoTile } from "@/components/home/partner-logo";
import { partners2025 } from "@/lib/partners-2025";

export function PartnersSection() {
  const contactEmail = CONTACT_EMAIL;

  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-line-2">
      <div className="container-page">
        {/* Header */}
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-ink-3">2025 PARTNERS</p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Previous Partners
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
            These companies shared our vision at Blockfest Africa 2025, and
            brought new eyes to their brand.
          </p>
        </div>

        {/*
          * The same white tiles as the 2026 wall. Last year's dark tiles are
          * what about half these files were drawn for, so the logos here
          * are the prepared copies scripts/logos-on-white.mjs writes.
          * mobile-grid-ok: logo tiles, three fit at 360px
          */}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 scale-in">
          {partners2025.map((partner) => (
            <li key={partner.name}>
              <LogoTile
                partner={partner}
                sizes="(min-width: 768px) 150px, 30vw"
                className="h-16 rounded-xl [--logo:22px] md:h-20 md:[--logo:24px]"
              />
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-10 rounded-xl border border-line-2 bg-card-2 p-6 lg:mt-14">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-bold leading-tight text-white">
              Be part of 2026&apos;s Web3 &amp; AI Revolution
            </h3>
            <p className="mt-4 text-base leading-relaxed text-ink">
              We took the movement across Africa in 2026. After the South Africa
              roadshow, the main event lands in Lagos this October. Attend,
              showcase your brand, or sponsor.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                asChild
                variant="gold"
                className="rounded-full px-7 text-base font-semibold"
                onClick={() => {
                  trackButtonClick("View 2026 Packages", "Partners Section");
                }}
              >
                <Link href="/#sponsorship">View 2026 Packages</Link>
              </Button>
              <Link
                href={`mailto:${contactEmail}`}
                passHref
                onClick={() => {
                  trackButtonClick("Become a sponsor", "Partners Section");
                }}
              >
                <Button
                  asChild
                  className="w-full rounded-full border border-line-2 bg-card-3 px-7 text-base font-semibold text-white hover:bg-white/20 sm:w-auto"
                >
                  <p>Contact Us</p>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
