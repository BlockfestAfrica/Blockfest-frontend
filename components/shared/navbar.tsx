"use client";
import Image from "next/image";
import { ChevronDown, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "../ui/sheet";
import Link from "next/link";
import BurgerIcon from "../icons/burger-icon";
import { gotham } from "@/lib/fonts";
import { CONTACT_EMAIL } from "@/lib/constants";
import { useRouter, usePathname } from "next/navigation";

const navLinkClasses =
  "text-base font-normal text-nav-gray hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light rounded px-1 py-2.5 inline-flex items-center min-h-11 transition-colors duration-300 ease-in-out";

/** Current page gets a gold underline, so you can always see where you are. */
const activeNavClasses =
  "text-white relative after:absolute after:left-1 after:right-1 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-gold";

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
      className={`${gotham.className} bg-ground sticky top-0 z-50 border-b border-white/10`}
    >
      <div className="container-page flex items-center justify-between py-4 lg:py-5">
      {/* Logo */}
      <Link href="/" className="inline-flex items-center cursor-pointer min-h-11">
        <Image
          src="/images/logo.png"
          alt="Blockfest Africa Logo"
          width={140}
          height={38}
          sizes="(max-width: 768px) 124px, 140px"
          unoptimized
          className="xl:w-[140px] xl:h-[38px] xl:aspect-[140/38] aspect-[140/38] w-[124px] h-[34px]"
        />
      </Link>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center gap-x-7" aria-label="Main navigation">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`${navLinkClasses} ${pathname === "/" ? activeNavClasses : ""}`}
        >
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
            className={`${navLinkClasses} inline-flex items-center gap-1 ${
              pathname.startsWith("/blockfest-") ? activeNavClasses : ""
            }`}
          >
            Past Events
            <ChevronDown
              className={`text-sm transition-transform duration-200 ${pastEventsOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {pastEventsOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-2 min-w-[190px] rounded-md bg-ground border border-white/20 shadow-lg py-2 z-50"
            >
              <Link
                href="/blockfest-south-africa-2026"
                role="menuitem"
                aria-current={pathname === "/blockfest-south-africa-2026" ? "page" : undefined}
                onClick={() => setPastEventsOpen(false)}
                className="block px-4 py-2.5 text-base font-normal text-nav-gray hover:text-white hover:bg-white/5 focus-visible:text-white transition-colors duration-200 ease-in-out"
              >
                South Africa &apos;26
              </Link>
              <Link
                href="/blockfest-2025"
                role="menuitem"
                aria-current={pathname === "/blockfest-2025" ? "page" : undefined}
                onClick={() => setPastEventsOpen(false)}
                className="block px-4 py-2.5 text-base font-normal text-nav-gray hover:text-white hover:bg-white/5 focus-visible:text-white transition-colors duration-200 ease-in-out"
              >
                2025 Recap
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/speakers"
          aria-current={pathname.startsWith("/speakers") ? "page" : undefined}
          className={`${navLinkClasses} ${pathname.startsWith("/speakers") ? activeNavClasses : ""}`}
        >
          Speakers
        </Link>
        <Link
          href="/tickets"
          aria-current={pathname === "/tickets" ? "page" : undefined}
          className={`${navLinkClasses} ${pathname === "/tickets" ? activeNavClasses : ""}`}
        >
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
          className="text-sm lg:text-base font-medium text-black w-fit bg-brand-gold hidden shadow-xs hover:bg-brand-gold-hover min-h-11 px-5 py-2 md:flex items-center justify-center rounded-md transition-colors duration-300 ease-in-out"
        >
          Get Tickets
        </Link>
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="-mr-2 flex h-11 w-11 items-center justify-center"
              >
                <BurgerIcon className="text-white" />
              </button>
            </SheetTrigger>
            {/* The panel grows with its content and is fixed, so on a short
                viewport the lower items were unreachable. Cap it and let it
                scroll. This has to land with the taller tap targets below,
                which push the panel further past the fold. */}
            <SheetContent
              side="top"
              className="max-h-[100dvh] overflow-y-auto overscroll-contain"
            >
              <MobileMenu />
            </SheetContent>
          </Sheet>
        </div>
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
      className={`${gotham.className} px-6 py-8 flex min-h-full flex-col bg-ground`}
    >
      {/* Close Button */}
      <div className="flex justify-end mb-8">
        <SheetClose asChild>
          <button
            type="button"
            aria-label="Close menu"
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-light"
          >
            <X size={28} className="text-white" />
          </button>
        </SheetClose>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-col gap-y-6 flex-grow">
        <SheetClose asChild>
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`text-lg font-medium transition w-fit min-h-11 inline-flex items-center ${
              pathname === "/"
                ? "text-white underline decoration-brand-gold decoration-2 underline-offset-8"
                : "text-nav-gray hover:text-white hover:underline"
            }`}
          >
            Home
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <button
            type="button"
            onClick={handleAboutClick}
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit min-h-11 inline-flex items-center"
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
            className="text-lg font-medium text-nav-gray hover:text-white transition w-fit min-h-11 inline-flex items-center gap-1.5"
          >
            Past Events
            <ChevronDown
              className={`text-base transition-transform duration-200 ${pastEventsOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {pastEventsOpen && (
            <div className="flex flex-col gap-y-4 mt-4 pl-4 border-l border-white/20">
              <SheetClose asChild>
                <Link
                  href="/blockfest-south-africa-2026"
                  className="text-base font-medium text-nav-gray hover:text-white hover:underline transition w-fit min-h-11 inline-flex items-center gap-1.5"
                >
                  South Africa &apos;26
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/blockfest-2025"
                  className="text-base font-medium text-nav-gray hover:text-white hover:underline transition w-fit min-h-11 inline-flex items-center gap-1.5"
                >
                  2025 Recap
                </Link>
              </SheetClose>
            </div>
          )}
        </div>

        <SheetClose asChild>
          <Link
            href="/speakers"
            aria-current={pathname === "/speakers" ? "page" : undefined}
            className={`text-lg font-medium transition w-fit min-h-11 inline-flex items-center ${
              pathname === "/speakers"
                ? "text-white underline decoration-brand-gold decoration-2 underline-offset-8"
                : "text-nav-gray hover:text-white hover:underline"
            }`}
          >
            Speakers
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/tickets"
            aria-current={pathname === "/tickets" ? "page" : undefined}
            className={`text-lg font-medium transition w-fit min-h-11 inline-flex items-center ${
              pathname === "/tickets"
                ? "text-white underline decoration-brand-gold decoration-2 underline-offset-8"
                : "text-nav-gray hover:text-white hover:underline"
            }`}
          >
            Tickets
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/#sponsorship"
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit min-h-11 inline-flex items-center"
          >
            Become a Sponsor
          </Link>
        </SheetClose>

        {/* Contact mailto link */}
        <SheetClose asChild>
          <a
            href={`mailto:${contactEmail}`}
            className="text-lg font-medium text-nav-gray hover:text-white hover:underline transition w-fit min-h-11 inline-flex items-center"
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