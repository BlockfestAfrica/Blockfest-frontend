"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import React, { useState, useEffect } from "react";
import { useUmami } from "@/lib/hooks/use-umami";
import { toast } from "sonner";

export function PartnersSection() {
  const { trackButtonClick, trackRegistration } = useUmami();
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "partnership@blockfestafrica.com";

  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_REGISTRATION_OPEN_AT;
    const fallbackIso = "2025-09-07T17:15:00.000Z";
    const parsed = Date.parse(env ?? fallbackIso);
    const openAtMs = Number.isFinite(parsed) ? parsed : Date.parse(fallbackIso);

    let timer: number | null = null;
    const MAX_DELAY = 2_147_483_647; // ~24.8 days

    const schedule = () => {
      const now = Date.now();
      if (now >= openAtMs) {
        setIsRegistrationOpen(true);
        return;
      }
      setIsRegistrationOpen(false);
      const delay = Math.min(openAtMs - now, MAX_DELAY);
      timer = window.setTimeout(schedule, delay);
    };

    schedule();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  const handleRegistrationClick = () => {
    trackButtonClick("Register Now", "Partners Section");
    trackRegistration("partners-cta");

    if (isRegistrationOpen) {
      // Registration is open - redirect to Luma
      window.open(
        "https://luma.com/gf1ye3cw?tk=AQAG9o",
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      // Show X Space invitation toast with dynamic date formatting
      const openAtStr =
        process.env.NEXT_PUBLIC_REGISTRATION_OPEN_AT ??
        "2025-09-07T17:15:00.000Z";
      const openAt = new Date(openAtStr);
      const isValidOpenAt = !Number.isNaN(openAt.getTime());
      const whenLagos = isValidOpenAt
        ? openAt.toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        : "soon";
      toast(
        `🎤 Join our X Space ${isValidOpenAt ? `${whenLagos} WAT` : whenLagos
        }!`,
        {
          description:
            "The registration link will be posted here once it opens.",
          style: {
            background:
              "linear-gradient(145deg, #000000 0%, #1DA1F2 15%, #000000 100%)",
            border: "2px solid #1DA1F2",
            color: "#FFFFFF",
            borderRadius: "16px",
            boxShadow:
              "0 20px 40px rgba(29, 161, 242, 0.4), 0 6px 20px rgba(0, 0, 0, 0.3)",
            fontWeight: "600",
            backdropFilter: "blur(12px)",
          },
          className:
            "font-bold text-lg [&>div]:text-white [&>div>div]:text-gray-200",
          duration: 7000,
          action: {
            label: "Join X Space",
            onClick: () =>
              window.open(
                "https://twitter.com/i/spaces/1kvJpMYEXALxE",
                "_blank",
                "noopener,noreferrer"
              ),
          },
        }
      );
    }
  };

  return (
    <section className="flex flex-col items-center justify-center px-5 py-8 lg:py-[60px] lg:px-[70px] bg-[#1B64E4]">
      {/* Industry Partners Section */}
      <div className="flex flex-col items-center justify-center space-y-5">
        <h2 className="font-medium text-[39px] lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] md:my-[15px] lg:my-[30px] text-center text-white">
          Partners
        </h2>

        {/* Sponsors Section */}
        <div className="w-full max-w-6xl mx-auto space-y-6">
          {/* Diamond Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-[#F2CB45] mb-4">
              💎 Diamond Sponsors
            </h3>
            <div className="flex justify-center">
              <Link
                href="https://jeroid.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 lg:p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-24 lg:h-28 w-64 lg:w-80">
                  <Image
                    src="/images/sponsors/jeroid-logo.png"
                    alt="Jeroid"
                    width={250}
                    height={100}
                    className="h-16 lg:h-20 w-auto object-contain"
                  />
                </div>
              </Link>
              {/* <Link
                href="https://0g.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 lg:p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-24 lg:h-28">
                  <Image
                    src="/images/sponsors/0g-lab-logo.png"
                    alt="0G Labs"
                    width={250}
                    height={100}
                    className="h-16 lg:h-20 w-auto object-contain"
                  />
                </div>
              </Link> */}
            </div>
          </div>

          {/* Gold Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-[#FFD700] mb-4">
              🥇 Gold Sponsors
            </h3>
            <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
              <Link
                href="https://hyperbridge.network"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 lg:p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-20 lg:h-24 w-48 lg:w-56">
                  <Image
                    src="/images/sponsors/hyperbridge-logo.png?v=2"
                    alt="Hyperbridge"
                    width={200}
                    height={80}
                    className="h-10 w-auto object-contain scale-[2]"
                  />
                </div>
              </Link>
              {/* <Link
                href="https://cakewallet.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 lg:p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-20 lg:h-24 w-48 lg:w-56">
                  <Image
                    src="/images/sponsors/cake-wallet-logo.png"
                    alt="Cake Wallet"
                    width={200}
                    height={80}
                    className="h-12 lg:h-16 w-auto object-contain"
                  />
                </div>
              </Link> */}
            </div>
          </div>

          {/* Silver Sponsors */}
          <div className="text-center">
            <h3 className="text-2xl lg:text-3xl font-bold text-[#C0C0C0] mb-4">
              🥈 Silver Sponsors
            </h3>
            <div className="flex items-center gap-5 justify-center">
              <div className="flex md:flex-row flex-col items-center gap-5 justify-center">
                <div className="flex justify-center">
                  <Link
                    href="https://gidi.africa"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 lg:p-2 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20 w-40 lg:w-48">
                      <Image
                        src="/images/sponsors/gidi-logo.png"
                        alt="Gidi"
                        width={240}
                        height={96}
                        className="h-full lg:h-full w-auto object-cover scale-125"
                      />
                    </div>
                  </Link>
                </div>

                <div className="flex justify-center">
                  <Link
                    href="https://jup.ag/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer w-fit h-fit">
                      <Image
                        src="/images/sponsors/jupiter.png"
                        alt="Jupiter"
                        width={240}
                        height={96}
                        className="max-h-20 w-auto object-contain"
                      />
                    </div>
                  </Link>
                </div>
              </div>
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
            <Link
              href="https://www.web3bridgeafrica.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/web3bridge-logo.webp"
                  alt="Web3Bridge"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain"
                />
              </div>
            </Link>

            <Link
              href="https://web3afrika.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/web3afrika-logo.png"
                  alt="Web3Afrika"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain"
                />
              </div>
            </Link>
            <Link
              href="https://bchainafrica.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/bchain-logo.jpg"
                  alt="Bchain"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain"
                />
              </div>
            </Link>
            <Link
              href="https://womenindefi.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 lg:p-1 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/wid-logo.png"
                  alt="WID"
                  width={300}
                  height={120}
                  className="h-full lg:h-full w-auto object-cover scale-170"
                />
              </div>
            </Link>
            <Link
              href="https://x.com/web3unilag"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 lg:p-1 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/web3unilag.png"
                  alt="Web3 Unilag"
                  width={200}
                  height={80}
                  className="h-full lg:h-full w-auto object-cover scale-130"
                />
              </div>
            </Link>
            <Link
              href="https://dtcsi.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 lg:p-1 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20 overflow-hidden">
                <Image
                  src="/images/community/dtcsi-logo.png"
                  alt="DTCSI"
                  width={150}
                  height={64}
                  className="h-full lg:h-full w-auto object-cover scale-200"
                />
              </div>
            </Link>
            <Link
              href="https://x.com/mgs_web3"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/mgsweb3-logo.png"
                  alt="MGS Web3"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain"
                />
              </div>
            </Link>
            <Link
              href="https://polkadot.africa/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20">
                <Image
                  src="/images/community/polkadot-logo.png"
                  alt="Polkadot Africa"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain scale-[3]"
                />
              </div>
            </Link>
          </div>
        </div>

        {/* Media Partners Section */}
        <div className="w-full max-w-6xl mx-auto pt-4">
          <div className="text-center mb-4">
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              📺 Media Partners
            </h3>
          </div>
          <div className="flex justify-center">
            <Link
              href="https://ambcrypto.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 lg:p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 flex items-center justify-center cursor-pointer h-18 lg:h-20 w-40 lg:w-48">
                <Image
                  src="/images/media/amd-logo.webp"
                  alt="AMD"
                  width={150}
                  height={64}
                  className="h-10 lg:h-12 w-auto object-contain"
                />
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-5 mt-12.5 lg:mt-[110px] text-white text-center">
        <h1 className="font-medium text-[39px] leading-[45.13px] lg:text-[69.65px] lg:leading-[82.21px] tracking-[-5%] xl:w-[55%] ">
          Be part of Africa&apos;s web3 Revolution
        </h1>
        <p className="font-medium text-sm lg:text-2xl lg:leading-[1.2] w-[90%] xl:w-[65%]">
          Whether you&apos;re ready to attend, showcase your brand, or invest in
          the future Blockfest Africa offers a front-row seat to innovation,
          culture, and community. Don&apos;t just watch the future happen be
          involved.
        </p>

        <div className="flex items-center justify-center gap-4 mt-5 mb-10 lg:mb-0">
          <Button
            className="font-semibold text-sm lg:text-[22px] rounded-[13px] p-[21px] lg:p-[34px] w-fit"
            onClick={handleRegistrationClick}
          >
            Register Now
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
              className="lg:p-[34px] font-semibold text-sm lg:text-[22px] rounded-[13px] p-[21px] w-fit  border border-white text-white bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
            >
              <p>Become a sponsor</p>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
