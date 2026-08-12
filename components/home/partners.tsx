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
    <div className="bg-white/10 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center p-4 h-20 lg:h-24">
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
      <Link href={href} target="_blank" rel="noopener noreferrer">
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
    <section className="flex flex-col items-center justify-center px-5 py-12 lg:py-16 lg:px-10 bg-gradient-to-b from-brand-blue to-brand-blue-dark">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4 border border-white/10">
            <span className="text-white font-semibold text-sm">
              2025 PARTNERS
            </span>
          </div>
          <h2 className="font-medium text-3xl lg:text-5xl lg:leading-tight tracking-[-5%] text-center text-white fade-in-on-scroll">
            Previous Partners
          </h2>
          <p className="text-white/70 text-base lg:text-lg mt-4 max-w-2xl mx-auto">
            These incredible companies shared our vision at Blockfest Africa
            2025 and brought many new eyes to their brand
          </p>
        </div>

        {/* Single unified grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4 scale-in">
          {allPartners.map((partner) => (
            <PartnerCard key={partner.alt} {...partner} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center justify-center space-y-5 mt-16 lg:mt-24 text-white text-center max-w-4xl">
        <h3 className="font-medium text-3xl lg:text-5xl leading-tight">
          Be part of 2026&apos;s Web3 Revolution
        </h3>
        <p className="text-white/80 text-sm lg:text-lg lg:leading-relaxed max-w-2xl">
          We took the movement across Africa in 2026. After the South Africa
          roadshow, the main event lands in Lagos this October. Attend, showcase
          your brand, or sponsor the future of Africa&apos;s web3 ecosystem.
        </p>

        <div className="flex items-center justify-center gap-4 mt-5 mb-10 lg:mb-0">
          <Link href="/#sponsorship">
            <Button
              className="font-semibold text-sm lg:text-base rounded-full px-6 py-5 lg:px-8 bg-brand-gold text-black hover:bg-brand-gold-hover"
              onClick={() => {
                trackButtonClick("View 2026 Packages", "Partners Section");
              }}
            >
              View 2026 Packages
            </Button>
          </Link>
          <Link
            href={`mailto:${contactEmail}`}
            passHref
            onClick={() => {
              trackButtonClick("Become a sponsor", "Partners Section");
            }}
          >
            <Button
              asChild
              className="font-semibold text-sm lg:text-base rounded-full px-6 py-5 lg:px-8 border border-white text-white bg-transparent hover:bg-white/10"
            >
              <p>Contact Us</p>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
