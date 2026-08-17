"use client";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import { FaInstagram, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import type { Menu } from "@/types";
import { gotham } from "@/lib/fonts";
import { CONTACT_EMAIL, SOCIAL_URLS } from "@/lib/constants";
import { useRouter, usePathname } from "next/navigation";
import { trackButtonClick } from "@/lib/sabilytics";
import { Newsletter } from "./newsletter";

const exploreMenu: Menu[] = [
  { path: "/", title: "Home" },
  { path: "/tickets", title: "Tickets" },
  { path: "/speakers", title: "Speakers" },
  { path: "/schedule", title: "Schedule" },
  { path: "/blockfest-south-africa-2026", title: "South Africa '26" },
  { path: "/blockfest-2025", title: "2025 Recap" },
];

const infoMenu: Menu[] = [
  { path: "/newsletter", title: "Newsletter" },
  { path: "/faq", title: "FAQ" },
  { path: "/travel", title: "Travel & Visa" },
  { path: "/call-for-speakers", title: "Call for Speakers" },
  { path: "/volunteer", title: "Volunteer" },
  { path: "/code-of-conduct", title: "Code of Conduct" },
  { path: `mailto:${CONTACT_EMAIL}`, title: "Contact" },
];

const socialLabels = ["Twitter / X", "Instagram", "YouTube", "LinkedIn"];

const Footer = () => {
  const router = useRouter();
  const pathname = usePathname();
  const handleAboutClick = () => {
    if (typeof window !== "undefined") {
      if (pathname === "/") {
        document.getElementById("about")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        router.push("/#about");
      }
    }
  };

  const socialIcons: Menu[] = [
    { path: SOCIAL_URLS.twitter, icon: <FaXTwitter size={18} /> },
    { path: SOCIAL_URLS.instagram, icon: <FaInstagram size={18} /> },
    { path: SOCIAL_URLS.youtube, icon: <FaYoutube size={18} /> },
    { path: SOCIAL_URLS.linkedin, icon: <FaLinkedin size={18} /> },
  ];

  const linkClasses =
    "text-base font-medium text-nav-gray hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light rounded transition-colors duration-300 ease-in-out w-fit inline-flex items-center min-h-11";

  const columnLabelClasses =
    "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-nav-gray/50 mb-5";

  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`${gotham.className} bg-ground border-t border-white/20`}
      id="contact"
    >
      <div className="container-page pt-14 lg:pt-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 lg:pb-14">
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center w-fit cursor-pointer min-h-11">
              <Image
                src="/images/logo.png"
                alt="Blockfest Africa Logo"
                width={140}
                height={38}
                sizes="(max-width: 768px) 124px, 140px"
                loading="lazy"
                className="xl:w-[140px] xl:h-[38px] xl:aspect-[140/38] aspect-[140/38] w-[124px] h-[34px]"
              />
            </Link>
            <p className="text-nav-gray text-sm lg:text-base max-w-xs">
              Africa&apos;s biggest Web3 and AI festival
            </p>
          </div>

          <Link
            href={`mailto:${CONTACT_EMAIL}?subject=Sponsorship Inquiry - Blockf3st Africa 2026`}
            onClick={() =>
              trackButtonClick("Email Sponsorship", "Sponsorship Section")
            }
            className="inline-flex items-center gap-2 bg-brand-gold text-black px-5 py-3.5 rounded-full font-semibold min-h-11 hover:bg-brand-gold-hover transition-colors text-sm sm:text-base max-w-full"
          >
            <span className="truncate"> 							Sponsor 2026
            </span>
          </Link>
        </div>

        <div className="border-t border-white/20" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-10 py-10 lg:py-14">
          <div>
            <p className={columnLabelClasses}>
              Explore
            </p>
            <nav className="flex flex-col gap-y-4">
              <Link href={exploreMenu[0].path} className={linkClasses}>
                {exploreMenu[0].title}
              </Link>
              <button
                type="button"
                onClick={handleAboutClick}
                className={linkClasses}
              >
                About
              </button>
              {exploreMenu.slice(1).map((item) => (
                <Link key={item.title} href={item.path} className={linkClasses}>
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className={columnLabelClasses}>
              Info
            </p>
            <nav className="flex flex-col gap-y-4">
              {infoMenu.map((item) => (
                <Link key={item.title} href={item.path} className={linkClasses}>
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <p className={columnLabelClasses}>
              Connect
            </p>
            <div className="flex items-center gap-x-3">
              {socialIcons.map((item, index) => (
                <Link
                  href={item.path}
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  key={index}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow us on ${socialLabels[index]}`}
                  className="flex items-center justify-center w-11 h-11 rounded-full border border-white/20 text-nav-gray hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light transition-colors duration-300 ease-in-out"
                >
                  {item.icon}
                </Link>
              ))}
            </div>

            <div className="mt-10">
              <Newsletter />
            </div>
          </div>
        </div>

        <div className="border-t border-white/20" />
      </div>

      {/* pb-20 reserves room for the fixed back-to-top button, which sat on
          the end of the copyright line. */}
      <div className="container-page py-6 pb-20 lg:pb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-nav-gray/60 text-sm order-2 sm:order-1">
          © {currentYear} Blockfest Africa. All rights reserved.
        </p>
        <p className="text-nav-gray/60 text-sm order-1 sm:order-2">
          partnership@blockfestafrica.com
        </p>
      </div>
    </footer>
  );
};

export default Footer;
