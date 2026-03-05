"use client";
import Image from "next/image";
import React from "react";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { Menu } from "@/types";
import { gotham } from "@/lib/fonts";
import { CONTACT_EMAIL, SOCIAL_URLS } from "@/lib/constants";

// Footer menu for 2026
const footerMenu: Menu[] = [
  { path: "/blockfest-2025", title: "2025 Recap" },
  { path: "about", title: "About" },
  { path: "/speakers", title: "Speakers" },
];

const Footer = () => {
  const contactEmail = CONTACT_EMAIL;

  const socialIcons: Menu[] = [
    {
      path: SOCIAL_URLS.twitter,
      icon: <FaXTwitter size={24} />,
    },
    {
      path: SOCIAL_URLS.instagram,
      icon: <FaInstagram size={24} />,
    },
    {
      path: SOCIAL_URLS.youtube,
      icon: <FaYoutube size={24} />,
    },
    {
      path: SOCIAL_URLS.linkedin,
      icon: <FaLinkedin size={24} />,
    },
  ];
  const socialLabels = ["Twitter / X", "Instagram", "YouTube", "LinkedIn"];

  return (
    <footer
      className={`${gotham.className} bg-black px-6 py-10 pt-14 lg:px-[70px] lg:py-[70px] flex flex-col lg:flex-row gap-y-10 items-start lg:items-end justify-between`}
      id="contact"
    >
      <div>
        <Link href="/" className="inline-block cursor-pointer">
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

      <div className="flex flex-col md:flex-row md:items-end md:gap-x-12.5 gap-y-8">
        {/* Navigation Menu - visible on all screen sizes */}
        <nav className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-x-6 gap-y-4 md:gap-x-12.5 md:gap-y-6">
          {footerMenu.map((item) => (
            <Link
              key={item.title}
              href={item.path}
              className="text-base xl:text-2xl font-medium cursor-pointer text-nav-gray hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded transition-colors duration-300 ease-in-out text-left"
            >
              {item.title}
            </Link>
          ))}

          <Link
            href="#sponsorship"
            className="text-base xl:text-2xl font-medium cursor-pointer text-nav-gray hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded transition-colors duration-300 ease-in-out"
          >
            Sponsor 2026
          </Link>

          <Link
            href="/faq"
            className="text-base xl:text-2xl font-medium cursor-pointer text-nav-gray hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded transition-colors duration-300 ease-in-out"
          >
            FAQ
          </Link>

          <Link
            href={`mailto:${contactEmail}`}
            className="text-base xl:text-2xl font-medium cursor-pointer text-nav-gray hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded transition-colors duration-300 ease-in-out"
          >
            Contact
          </Link>
        </nav>

        {/* Social Icons - min 44px tap targets with aria-labels */}
        <div className="flex items-center gap-x-2">
          {socialIcons.map((item, index) =>
            item.icon ? (
              <Link
                href={item.path}
                key={index}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow us on ${socialLabels[index]}`}
                className="flex items-center justify-center w-11 h-11 rounded-full cursor-pointer text-nav-gray hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold transition-colors duration-300 ease-in-out"
              >
                {item.icon}
              </Link>
            ) : null
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <Link href="#sponsorship">
          <Button
            type="button"
            variant="ghost"
            className="text-black bg-brand-gold hover:bg-brand-gold-hover border-0 px-[38px] py-5 text-lg font-semibold cursor-pointer rounded-xl"
          >
            Sponsor 2026
          </Button>
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
