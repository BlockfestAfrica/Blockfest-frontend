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
  imageClassName?: string;
  cardClassName?: string;
}

const CARD_BASE =
  "bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer";

function PartnerCard({
  src,
  alt,
  href,
  width = 150,
  height = 64,
  imageClassName = "h-10 lg:h-12 w-auto object-contain",
  cardClassName = "p-3 lg:p-4 h-18 lg:h-20",
}: PartnerInfo) {
  const card = (
    <div className={`${CARD_BASE} ${cardClassName}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={imageClassName}
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

const diamondSponsors: PartnerInfo[] = [
  {
    src: "/images/sponsors/jeroid-logo.png",
    alt: "Jeroid",
    href: "https://jeroid.co",
    width: 250,
    height: 100,
    imageClassName: "h-16 lg:h-20 w-auto object-contain",
    cardClassName: "p-6 lg:p-8 h-24 lg:h-28 w-64 lg:w-80",
  },
];

const goldSponsors: PartnerInfo[] = [
  {
    src: "/images/sponsors/hb-logo.png",
    alt: "Hyperbridge",
    href: "https://hyperbridge.network",
    width: 1081,
    height: 601,
    imageClassName: "h-16 lg:h-20 w-auto object-contain",
    cardClassName: "p-4 lg:p-6 h-20 lg:h-24 w-48 lg:w-56",
  },
  {
    src: "/images/sponsors/cake-wallet-logo.png",
    alt: "Cake Wallet",
    href: "https://cakewallet.com",
    width: 200,
    height: 80,
    imageClassName: "h-12 lg:h-16 w-auto object-contain",
    cardClassName: "p-4 lg:p-6 h-20 lg:h-24 w-48 lg:w-56",
  },
];

const silverSponsors: PartnerInfo[] = [
  {
    src: "/images/sponsors/gidi-logo.png",
    alt: "Gidi",
    href: "https://gidirealestateinvestment.com/",
    width: 200,
    height: 80,
    imageClassName: "max-h-16 lg:max-h-18 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/sponsors/jupiter.png",
    alt: "Jupiter",
    href: "https://jup.ag/",
    width: 200,
    height: 80,
    imageClassName: "h-12 lg:h-14 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/sponsors/hb.png",
    alt: "Huele bien",
    href: "https://linktr.ee/Huelebienbyprudent",
    imageClassName: "h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/sponsors/somnia.png",
    alt: "Somnia africa",
    href: "https://x.com/somniainafrica",
    imageClassName: "h-16 w-auto object-contain",
  },
  {
    src: "/images/sponsors/avalanche.png",
    alt: "Avalanche",
    href: "https://x.com/team1ng?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    imageClassName: "h-16 w-auto object-contain",
  },
  {
    src: "/images/sponsors/sui.png",
    alt: "Sui Network",
    href: "https://x.com/SuiNetwork?s=09",
    width: 200,
    height: 80,
    imageClassName: "h-12 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
];

const communityPartners: PartnerInfo[] = [
  {
    src: "/images/community/web3bridge-logo.webp",
    alt: "Web3Bridge",
    href: "https://www.web3bridgeafrica.com/",
  },
  {
    src: "/images/community/web3afrika-logo.png",
    alt: "Web3Afrika",
    href: "https://web3afrika.com",
  },
  {
    src: "/images/community/bchain-logo.png",
    alt: "Bchain",
    href: "https://bchainafrica.com/",
    imageClassName: "max-h-16 lg:max-h-18 w-auto object-contain",
  },
  {
    src: "/images/community/wid-logo.png",
    alt: "WID",
    href: "https://womenindefi.org/",
    width: 300,
    height: 120,
    imageClassName: "max-h-14 lg:max-h-16 w-auto object-contain",
    cardClassName: "p-2 lg:p-3 h-18 lg:h-20 overflow-hidden",
  },
  {
    src: "/images/community/web3unilag.png",
    alt: "Web3 Unilag",
    href: "https://x.com/web3unilag",
    width: 200,
    height: 80,
    imageClassName: "max-h-14 lg:max-h-16 w-auto object-contain",
    cardClassName: "p-2 lg:p-3 h-18 lg:h-20 overflow-hidden",
  },
  {
    src: "/images/community/dtcsi-logo.png",
    alt: "DTCSI",
    href: "https://dtcsi.com",
    imageClassName: "max-h-14 lg:max-h-16 w-auto object-contain",
    cardClassName: "p-2 lg:p-3 h-18 lg:h-20 overflow-hidden",
  },
  {
    src: "/images/community/mgsweb3-logo.png",
    alt: "MGS Web3",
    href: "https://x.com/mgs_web3",
  },
  {
    src: "/images/community/polkadot-logo.png",
    alt: "Polkadot Africa",
    href: "https://polkadot.africa/",
    imageClassName: "max-h-16 lg:max-h-18 w-auto object-contain",
  },
  {
    src: "/images/community/webnig.png",
    alt: "Web3 Nigeria",
    href: "https://x.com/Web3Nigeria?s=09",
  },
  {
    src: "/images/community/guild.png",
    alt: "Guild Academy",
    href: "https://x.com/GuildAcademy_",
  },
  {
    src: "/images/community/bnug.png",
    alt: "blockchain nigeria user group",
    href: "https://x.com/blockchainNG",
  },
  {
    src: "/images/community/hive2.png",
    alt: "Insidethehive Image",
    href: "https://x.com/InsideDHive",
    imageClassName: "h-20 w-auto object-contain",
  },
];

const mediaPartners: PartnerInfo[] = [
  {
    src: "/images/media/ifemedia.png",
    alt: "Ife Media",
    imageClassName: "h-14 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/amd-logo.webp",
    alt: "AMD",
    href: "https://ambcrypto.com/",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/3FBA.png",
    alt: "Forex Blogger Ayo",
    href: "https://x.com/forexbloggerayo?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
    imageClassName: "h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/businessday.svg",
    alt: "Business day",
    imageClassName: "max-h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/guardian.svg",
    alt: "Guardian",
    imageClassName: "h-14 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/legit.svg",
    alt: "legit",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/Punch.svg",
    alt: "punch newspaper",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/tclogo.svg",
    alt: "techcabal",
    imageClassName: "h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/techpoint.svg",
    alt: "techpoint",
    imageClassName: "h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/media/mona.png",
    alt: "Mona the persona",
    imageClassName: "h-12 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
];

const ecosystemPartners: PartnerInfo[] = [
  {
    src: "/images/ecosystem/lsg2.png",
    alt: "Lagos state government",
    imageClassName: "h-18 md:h-20 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/ecosystem/gadget2.png",
    alt: "Igadgetmart",
    imageClassName: "max-h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/ecosystem/siban.png",
    alt: "SIBAN",
    href: "https://siban.org/",
    imageClassName: "max-h-14 lg:max-h-16 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/ecosystem/fan.png",
    alt: "FanYogo",
    imageClassName: "h-18 md:h-20 w-auto object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
  {
    src: "/images/ecosystem/base.png",
    alt: "Base West Africa",
    href: "https://x.com/BasedWestAfrica",
    imageClassName: "h-16 lg:h-14 w-fit object-contain",
    cardClassName: "p-3 lg:p-4 h-18 lg:h-20 w-40 lg:w-48",
  },
];

export function PartnersSection() {
  const { trackButtonClick } = useUmami();
  const contactEmail = CONTACT_EMAIL;

  useSubtleAnimations();

  return (
    <section className="flex flex-col items-center justify-center px-5 py-16 lg:py-24 lg:px-10 bg-brand-blue">
      {/* Industry Partners Section */}
      <div className="flex flex-col items-center justify-center space-y-5 w-full max-w-7xl">
        {/* Header with 2025 badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-4 border border-white/20">
            <span className="text-brand-gold font-semibold text-sm">
              ✨ 2025 PARTNERS
            </span>
          </div>
          <h2 className="font-medium text-4xl lg:text-7xl lg:leading-tight tracking-[-5%] text-center text-white fade-in-on-scroll">
            Previous Partners
          </h2>
          <p className="text-white/70 text-base lg:text-lg mt-4 max-w-2xl mx-auto">
            These incredible companies shared our vision at Blockfest Africa
            2025 and brought many new eyes to their brand
          </p>
        </div>

        {/* Sponsors Section */}
        <div className="w-full max-w-6xl mx-auto space-y-6 scale-in mt-8">
          {/* Diamond Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-brand-gold mb-4">
              💎 Diamond Sponsors
            </h3>
            <div className="flex justify-center">
              {diamondSponsors.map((partner) => (
                <PartnerCard key={partner.alt} {...partner} />
              ))}
            </div>
          </div>

          {/* Gold Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-[#FFD700] mb-4">
              🥇 Gold Sponsors
            </h3>
            <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
              {goldSponsors.map((partner) => (
                <PartnerCard key={partner.alt} {...partner} />
              ))}
            </div>
          </div>

          {/* Silver Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-[#C0C0C0] mb-4">
              🥈 Silver Sponsors
            </h3>
            <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
              {silverSponsors.map((partner) => (
                <PartnerCard key={partner.alt} {...partner} />
              ))}
            </div>
          </div>
        </div>

        {/* Community Partners Section */}
        <div className="w-full max-w-6xl mx-auto pt-4">
          <div className="text-center mb-4">
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              🤝 Community Partners
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {communityPartners.map((partner) => (
              <PartnerCard key={partner.alt} {...partner} />
            ))}
          </div>
        </div>

        {/* Media Partners Section */}
        <div className="w-full max-w-6xl mx-auto pt-4">
          <div className="text-center mb-4">
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              📺 Media Partners
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {mediaPartners.map((partner) => (
              <div key={partner.alt} className="flex justify-center">
                <PartnerCard {...partner} />
              </div>
            ))}
          </div>
        </div>

        {/* Ecosystem Partners Section */}
        <div className="w-full max-w-6xl mx-auto pt-4">
          <div className="text-center mb-4">
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              🌐 Ecosystem Partners
            </h3>
          </div>
          <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
            {ecosystemPartners.map((partner) => (
              <div key={partner.alt} className="flex justify-center">
                <PartnerCard {...partner} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-5 mt-12.5 lg:mt-[110px] text-white text-center">
        <h1 className="font-medium text-4xl leading-tight lg:text-7xl lg:leading-tight tracking-[-5%] xl:w-[55%] md:w-[65%]">
          Be part of 2026&apos;s Web3 Revolution
        </h1>
        <p className="font-medium text-sm lg:text-2xl lg:leading-[1.2] md:w-[75%] w-[90%] xl:w-[65%]">
          We&apos;re going bigger in 2026 with TWO events - Cape Town in May
          and Lagos in October. Whether you want to attend, showcase your brand,
          or sponsor the future of Africa&apos;s web3 ecosystem, Blockfest
          Africa offers a front-row seat to innovation, culture, and community.
        </p>

        <div className="flex items-center justify-center gap-4 mt-5 mb-10 lg:mb-0">
          <Link href="#sponsorship">
            <Button
              className="font-semibold text-sm lg:text-xl rounded-xl p-5 lg:p-8 w-fit bg-brand-gold text-black hover:bg-brand-gold-hover"
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
              className="lg:p-8 font-semibold text-sm lg:text-xl rounded-xl p-5 w-fit  border border-white text-white bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
            >
              <p>Contact Us</p>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
