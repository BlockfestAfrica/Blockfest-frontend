"use client";
import { FaLocationDot } from "react-icons/fa6";
import { GoDotFill } from "react-icons/go";
import { IoCalendarClearOutline } from "react-icons/io5";
import { Button } from "../ui/button";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useUmami } from "@/lib/hooks/use-umami";
import { toast } from "sonner";

export function HeroSection() {
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
    trackButtonClick("Register Now", "Hero Section");
    trackRegistration("hero-cta");

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
        `🎤 Join our X Space ${
          isValidOpenAt ? `${whenLagos} WAT` : whenLagos
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
    <section
      className="relative w-full flex items-center justify-center bg-[url('/images/hero.webp')] bg-cover bg-center bg-no-repeat min-h-[65vh] 2xl:min-h-[65vh] xl:min-h-screen md:min-h-screen lg:min-h-screen object-contain  "
      id="home"
    >
      <div className="flex items-center flex-col space-y-4  text-center text-black mt-50 mb-20 md:my-20 lg:my-30">
        <p className="font-medium text-[10px] lg:text-base lg:text-[22.3px] uppercase bg-[#F2CB45] px-4 py-3.5 lg:px-[35px] lg:py-[26px] rounded-[5px] lg:rounded-[10.71px]">
          welcome to blockfest 2025
        </p>
        <p className="text-[43px] lg:text-5xl leading-13 lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] font-[350px]">
          Africa&apos;s biggest web<span className="text-[#F2CB45]">3</span>{" "}
          {""}
          festival
        </p>
        <div className="flex items-center justify-center lg:space-x-2 text-lg lg:text-[28px] font-medium text-[#1A63E3]">
          <p>BUIDL</p>
          <GoDotFill />
          <p>BRIDGE</p>
          <GoDotFill />
          <p>BECOME</p>
        </div>
        <div className="flex items-center justify-center md:space-x-8 space-x-[18px] text-[10px] lg:text-base font-medium text-black">
          <div className="flex items-center space-x-1 lg:space-x-2 uppercase ">
            <FaLocationDot className="text-[#F34C73]" />
            <span>lagos,nigeria</span>
          </div>
          <div className="flex items-center space-x-1 lg:space-x-2 uppercase">
            <IoCalendarClearOutline className="text-[#F34C73]" />
            <span>October 11th, 2025</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-5 mb-10 lg:mb-0">
          <Button
            className="font-semibold text-sm lg:text-[22px] rounded-[13px] p-[21px] lg:p-[34px] w-fit"
            onClick={handleRegistrationClick}
          >
            Register Now
          </Button>
          <Link href={`mailto:${contactEmail}`} passHref>
            <Button
              asChild
              className="lg:p-[34px] font-semibold text-sm lg:text-[22px] rounded-[13px] p-[21px] w-fit  border border-[#1B64E4] text-[#1B64E4] bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
              onClick={() => {
                trackButtonClick("Become a sponsor", "Hero Section");
              }}
            >
              <p>Become a sponsor</p>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
