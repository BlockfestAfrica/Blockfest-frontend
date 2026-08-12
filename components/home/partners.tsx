"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import React from "react";
import { useUmami } from "@/lib/hooks/use-umami";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";

interface PartnerInfo {
  src: string;
  alt: string;
  href?: string;
  width?: number;
  height?: number;
}

function PartnerCard({ src, alt, href, width = 150, height = 64 }: PartnerInfo) {
  const card = (
    <div className="flex h-20 items-center justify-center rounded-xl border border-white/20 bg-white/5 p-4 transition-colors duration-300 hover:bg-white/10 lg:h-24">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-10 lg:h-14 w-auto object-contain"
      />
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl"
      >
        {card}
      </Link>
    );
  }

  return card;
}

const allPartners: PartnerInfo[] = [
  // Sponsors
  { src: "/images/sponsors/jeroid-logo.png", alt: "Jeroid", href: "https://jeroid.co", width: 250, height: 100 },
  { src: "/images/sponsors/hb-logo.png", alt: "Hyperbridge", href: "https://hyperbridge.network", width: 1081, height: 601 },
  { src: "/images/sponsors/cake-wallet-logo.png", alt: "Cake Wallet", href: "https://cakewallet.com", width: 200, height: 80 },
  { src: "/images/sponsors/gidi-logo.png", alt: "Gidi", href: "https://gidirealestateinvestment.com/", width: 200, height: 80 },
  { src: "/images/sponsors/jupiter.png", alt: "Jupiter", href: "https://jup.ag/", width: 200, height: 80 },
  { src: "/images/sponsors/hb.png", alt: "Huele bien", href: "https://linktr.ee/Huelebienbyprudent" },
  { src: "/images/sponsors/somnia.png", alt: "Somnia africa", href: "https://x.com/somniainafrica" },
  { src: "/images/sponsors/avalanche.png", alt: "Avalanche", href: "https://x.com/team1ng?s=21&t=6lhy88Nx16NRD-zFs2-S9w" },
  { src: "/images/sponsors/sui.png", alt: "Sui Network", href: "https://x.com/SuiNetwork?s=09", width: 200, height: 80 },
  // Community
  { src: "/images/community/web3bridge-logo.webp", alt: "Web3Bridge", href: "https://www.web3bridgeafrica.com/" },
  { src: "/images/community/web3afrika-logo.png", alt: "Web3Afrika", href: "https://web3afrika.com" },
  { src: "/images/community/bchain-logo.png", alt: "Bchain", href: "https://bchainafrica.com/" },
  { src: "/images/community/wid-logo.png", alt: "WID", href: "https://womenindefi.org/", width: 300, height: 120 },
  { src: "/images/community/web3unilag.png", alt: "Web3 Unilag", href: "https://x.com/web3unilag", width: 200, height: 80 },
  { src: "/images/community/dtcsi-logo.png", alt: "DTCSI", href: "https://dtcsi.com" },
  { src: "/images/community/mgsweb3-logo.png", alt: "MGS Web3", href: "https://x.com/mgs_web3" },
  { src: "/images/community/polkadot-logo.png", alt: "Polkadot Africa", href: "https://polkadot.africa/" },
  { src: "/images/community/webnig.png", alt: "Web3 Nigeria", href: "https://x.com/Web3Nigeria?s=09" },
  { src: "/images/community/guild.png", alt: "Guild Academy", href: "https://x.com/GuildAcademy_" },
  { src: "/images/community/bnug.png", alt: "blockchain nigeria user group", href: "https://x.com/blockchainNG" },
  { src: "/images/community/hive2.png", alt: "Insidethehive Image", href: "https://x.com/InsideDHive" },
  // Media
  { src: "/images/media/ifemedia.png", alt: "Ife Media" },
  { src: "/images/media/amd-logo.webp", alt: "AMD", href: "https://ambcrypto.com/" },
  { src: "/images/media/3FBA.png", alt: "Forex Blogger Ayo", href: "https://x.com/forexbloggerayo?s=21&t=6lhy88Nx16NRD-zFs2-S9w" },
  { src: "/images/media/businessday.svg", alt: "Business day" },
  { src: "/images/media/guardian.svg", alt: "Guardian" },
  { src: "/images/media/legit.svg", alt: "legit" },
  { src: "/images/media/Punch.svg", alt: "punch newspaper" },
  { src: "/images/media/tclogo.svg", alt: "techcabal" },
  { src: "/images/media/techpoint.svg", alt: "techpoint" },
  { src: "/images/media/mona.png", alt: "Mona the persona" },
  // Ecosystem
  { src: "/images/ecosystem/lsg2.png", alt: "Lagos state government" },
  { src: "/images/ecosystem/gadget2.png", alt: "Igadgetmart" },
  { src: "/images/ecosystem/siban.png", alt: "SIBAN", href: "https://siban.org/" },
  { src: "/images/ecosystem/fan.png", alt: "FanYogo" },
  { src: "/images/ecosystem/base.png", alt: "Base West Africa", href: "https://x.com/BasedWestAfrica" },
];

export function PartnersSection() {
  const { trackButtonClick } = useUmami();
  const contactEmail = CONTACT_EMAIL;

  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        {/* Header */}
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-white/60">2025 PARTNERS</p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Previous Partners
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            These companies shared our vision at Blockfest Africa 2025, and
            brought new eyes to their brand.
          </p>
        </div>

        {/* Single unified grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 lg:gap-4 scale-in">
          {allPartners.map((partner) => (
            <PartnerCard key={partner.alt} {...partner} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-xl border border-white/20 bg-white/5 p-6 lg:mt-14">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-bold leading-tight text-white">
              Be part of 2026&apos;s Web3 &amp; AI Revolution
            </h3>
            <p className="mt-4 text-base leading-relaxed text-white/90">
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
                  className="w-full rounded-full border border-white/20 bg-white/10 px-7 text-base font-semibold text-white hover:bg-white/20 sm:w-auto"
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
