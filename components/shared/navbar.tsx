"use client";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "../ui/sheet";
import { AiOutlineClose } from "react-icons/ai";
import { IoChevronDown } from "react-icons/io5";
import Link from "next/link";
import BurgerIcon from "../icons/burger-icon";
import { gotham } from "@/lib/fonts";
import { CONTACT_EMAIL } from "@/lib/constants";
import { useRouter, usePathname } from "next/navigation";

const navLinkClasses =
  "text-base font-normal text-nav-gray hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light rounded px-1 py-1 transition-colors duration-300 ease-in-out";

const Navbar = () => {
  const contactEmail = CONTACT_EMAIL;

  const router = useRouter();
  const pathname = usePathname();

  const [pastEventsOpen, setPastEventsOpen] = useState(false);
  const pastEventsRef = useRef<HTMLDivElement>(null);

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

  // Clean up #about in URL after navigating
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#about") {
      const el = document.getElementById("about");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", "/");
      }
    }
  }, []);

  // Close the Past Events dropdown on outside click or Escape
  useEffect(() => {
    if (!pastEventsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pastEventsRef.current &&
        !pastEventsRef.current.contains(e.target as Node)
      ) {
        setPastEventsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPastEventsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [pastEventsOpen]);

  return (
    <header
      className={`${gotham.className} bg-black px-5 lg:px-[70px] py-4 lg:py-10 flex items-center justify-between sticky top-0 z-50`}
    >
      {/* Logo */}
      <Link href="/" className="cursor-pointer">
        <Image
          src="/images/logo.svg"
          alt="Blockfest Africa Logo"
          width={140}
          height={38}
          sizes="(max-width: 768px) 124px, 140px"
          priority
          className="xl:w-[140px] xl:h-[38px] xl:aspect-[140/38] aspect-[124/24] w-[124px] h-[24px]"
        />
      </Link>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center gap-x-7" aria-label="Main navigation">
        <Link href="/" className={navLinkClasses}>
          Home
        </Link>
        <button type="button" onClick={handleAboutClick} className={navLinkClasses}>
          About
        </button>

        {/* Past Events dropdown */}
        <div className="relative" ref={pastEventsRef}>
          <button
            type="button"
            onClick={() => setPastEventsOpen((open) => !open)}
            aria-expanded={pastEventsOpen}
            aria-haspopup="true"
            className={`${navLinkClasses} inline-flex items-center gap-1`}
          >
            Past Events
            <IoChevronDown
              className={`text-sm transition-transform duration-200 ${pastEventsOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {pastEventsOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-2 min-w-[190px] rounded-md bg-black border border-white/10 shadow-lg py-2 z-50"
            >
              <Link
                href="/blockfest-south-africa-2026"
                role="menuitem"
                onClick={() => setPastEventsOpen(false)}
                className="block px-4 py-2.5 text-base font-normal text-nav-gray hover:text-white hover:bg-white/5 focus-visible:text-white focus-visible:outline-none transition-colors duration-200 ease-in-out"
              >
                South Africa &apos;26 <span className="text-sm">🇿🇦</span>
              </Link>
              <Link
                href="/blockfest-2025"
                role="menuitem"
                onClick={() => setPastEventsOpen(false)}
                className="block px-4 py-2.5 text-base font-normal text-nav-gray hover:text-white hover:bg-white/5 focus-visible:text-white focus-visible:outline-none transition-colors duration-200 ease-in-out"
              >
                2025 Recap <span className="text-sm">🇳🇬</span>
              </Link>
            </div>
          )}
        </div>

        <Link href="/speakers" className={navLinkClasses}>
          Speakers
        </Link>
        <Link href="/tickets" className={navLinkClasses}>
          Tickets
        </Link>
        <Link href="/#sponsorship" className={navLinkClasses}>
          Sponsor
        </Link>
        <Link href={`mailto:${contactEmail}`} className={navLinkClasses}>
          Contact
        </Link>
      </nav>

      {/* Right Side */}
      <div className="flex items-center gap-x-5">
        <Link
          href="/tickets"
          className="md:p-5 text-sm lg:text-base font-medium text-black w-fit p-3 bg-brand-gold hidden shadow-xs hover:bg-brand-gold-hover h-9 px-5 py-2 md:flex items-center justify-center rounded-md transition-colors duration-300 ease-in-out"
        >
          Get Tickets
        </Link>
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" aria-label="Open menu" className="p-2 -m-2">
                <BurgerIcon className="text-white" />
              </button>
            </SheetTrigger>
            <SheetContent side="top">
              <MobileMenu />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

const MobileMenu = () => {
  const contactEmail = CONTACT_EMAIL;

  const router = useRouter();
  const pathname = usePathname();

  const [pastEventsOpen, setPastEventsOpen] = useState(false);

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

  return (
    <div
      className={`${gotham.className} px-6 py-8 flex flex-col h-full bg-black`}
    >
      {/* Close Button */}
      <div className="flex justify-end mb-8">
        <SheetClose asChild>
          <button
            type="button"
            aria-label="Close menu"
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light"
          >
            <AiOutlineClose size={28} className="text-white" />
          </button>
        </SheetClose>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-col gap-y-6 flex-grow">
        <SheetClose asChild>
          <Link
            href="/"
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            Home
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <button
            type="button"
            onClick={handleAboutClick}
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            About
          </button>
        </SheetClose>

        {/* Past Events accordion (mobile) */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setPastEventsOpen((open) => !open)}
            aria-expanded={pastEventsOpen}
            className="text-lg font-medium text-nav-gray hover:text-white transition w-fit inline-flex items-center gap-1.5"
          >
            Past Events
            <IoChevronDown
              className={`text-base transition-transform duration-200 ${pastEventsOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {pastEventsOpen && (
            <div className="flex flex-col gap-y-4 mt-4 pl-4 border-l border-white/10">
              <SheetClose asChild>
                <Link
                  href="/blockfest-south-africa-2026"
                  className="text-base font-medium text-nav-gray hover:text-white hover:underline transition w-fit inline-flex items-center gap-1.5"
                >
                  South Africa &apos;26 <span>🇿🇦</span>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/blockfest-2025"
                  className="text-base font-medium text-nav-gray hover:text-white hover:underline transition w-fit inline-flex items-center gap-1.5"
                >
                  2025 Recap <span>🇳🇬</span>
                </Link>
              </SheetClose>
            </div>
          )}
        </div>

        <SheetClose asChild>
          <Link
            href="/speakers"
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            Speakers
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/tickets"
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            Tickets
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/#sponsorship"
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            Become a Sponsor
          </Link>
        </SheetClose>

        {/* Contact mailto link */}
        <SheetClose asChild>
          <a
            href={`mailto:${contactEmail}`}
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit"
          >
            Contact
          </a>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/tickets"
            className="mt-2 inline-flex w-fit items-center justify-center rounded-md bg-brand-gold px-6 py-3 text-base font-semibold text-black transition-colors hover:bg-brand-gold-hover"
          >
            Get Tickets
          </Link>
        </SheetClose>
      </div>
    </div>
  );
};

export default Navbar;