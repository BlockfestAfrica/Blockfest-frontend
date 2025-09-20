"use client";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { Menu } from "@/types";
import { useUmami } from "@/lib/hooks/use-umami";
import { toast } from "sonner";
import { gotham } from "@/lib/fonts";

// Footer menu (removed "Contacts" and "Sponsors" for special handling)
const footerMenu: Menu[] = [
  { path: "agenda", title: "Agenda" },
  { path: "about", title: "About" },
  { path: "/blogs", title: "Blogs" },
  { path: "speakers", title: "Speakers" },
];

// Smooth scroll helper
const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const Footer = () => {
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
    trackButtonClick("Register Now", "Footer Section");
    trackRegistration("footer-cta");

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

  const twitterHandle = (
    process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@blockfestafrica"
  ).replace("@", "");
  const instagramHandle =
    process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || "blockfestafrica";
  const youtubeChannel =
    process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL || "@blockfestafrica";
  const linkedinPage =
    process.env.NEXT_PUBLIC_LINKEDIN_PAGE || "company/blockfest-africa";

  const socialIcons: Menu[] = [
    {
      path: `https://x.com/${twitterHandle}`,
      icon: <FaXTwitter size={24} />,
    },
    {
      path: `https://www.instagram.com/${instagramHandle}`,
      icon: <FaInstagram size={24} />,
    },
    {
      path: `https://youtube.com/${youtubeChannel}`,
      icon: <FaYoutube size={24} />,
    },
    {
      path: `https://www.linkedin.com/${linkedinPage}`,
      icon: <FaLinkedin size={24} />,
    },
  ];
  return (
    <footer
      className={`${gotham.className} bg-black px-10 py-10 pt-14 lg:p-[70px] flex gap-y-10  items-center md:items-end justify-between`}
      id="contact"
    >
      <div className="">
        <Link href="/insights" className="inline-block cursor-pointer">
          <Image
            src="/images/footer-logo.svg"
            alt="Blockfest Africa Footer Logo"
            width={150}
            height={49}
            sizes="(max-width: 768px) 124px, 150px"
            loading="lazy"
            className="xl:w-[150px] w-[124px] h-[42px] xl:h-[49px] aspect-[124/42] xl:aspect-[150/49] hover:opacity-80 transition-opacity duration-200"
          />
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:gap-x-12.5 gap-y-10">
        {/* Navigation Menu */}
        <nav className="hidden lg:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4 md:gap-x-12.5 md:gap-y-6">
          {footerMenu.map((item) => (
            <button
              type="button"
              key={item.title}
              onClick={() => scrollToSection(item.path)}
              className="text-base xl:text-2xl font-medium cursor-pointer text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out text-left"
            >
              {item.title}
            </button>
          ))}

          {/* Sponsors mailto link */}
          <Link
            href={`mailto:${contactEmail}`}
            className="text-base xl:text-2xl font-medium cursor-pointer text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
          >
            Sponsors
          </Link>

          {/* Badge Generator link */}
          <Link
            href="/getdp"
            className="text-base xl:text-2xl font-medium cursor-pointer text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
          >
            Badge
          </Link>

          {/* Contact mailto link */}
          <Link
            href={`mailto:${contactEmail}`}
            className="text-base xl:text-2xl font-medium cursor-pointer text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
          >
            Contact
          </Link>
        </nav>

        {/* Social Icons */}
        <div className="flex items-center gap-x-3">
          {socialIcons.map((item, index) =>
            item.icon ? (
              <Link
                href={item.path}
                key={index}
                target="_blank"
                className="cursor-pointer text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
              >
                {item.icon}
              </Link>
            ) : null
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <Button
          type="button"
          variant="ghost"
          onClick={handleRegistrationClick}
          className="text-white border-2 px-[38px] py-5 text-lg font-semibold cursor-pointer rounded-[12px]"
        >
          Register
        </Button>
      </div>
    </footer>
  );
};

export default Footer;
