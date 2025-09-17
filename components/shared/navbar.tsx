"use client";
import Image from "next/image";
import React, { useEffect } from "react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "../ui/sheet";
import { AiOutlineClose } from "react-icons/ai";
import Link from "next/link";
import BurgerIcon from "../icons/burger-icon";
import { gotham } from "@/lib/fonts";
import { useRouter, usePathname } from "next/navigation";

const Navbar = () => {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "partnership@blockfestafrica.com";

  const router = useRouter();
  const pathname = usePathname();

  const handleAboutClick = () => {
    if (pathname === "/") {
      document.getElementById("about")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      router.push("/#about");
    }
  };

  // Clean up #about in URL after navigating
  useEffect(() => {
    if (window.location.hash === "#about") {
      const el = document.getElementById("about");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", "/");
      }
    }
  }, []);

  return (
    <div
      className={`${gotham.className} bg-white md:bg-black px-5 lg:px-[70px] py-5 lg:py-10 flex items-center justify-between`}
    >
      {/* Logo */}
      <Link href="/" className="cursor-pointer">
        <Image
          src="/images/mobile-logo.svg"
          alt="Blockfest Africa Logo"
          width={140}
          height={38}
          sizes="(max-width: 768px) 124px, 140px"
          priority
          className="xl:w-[140px] xl:h-[38px] xl:aspect-[140/38] aspect-[124/24] w-[124px] h-[24px] block md:hidden"
        />
        <Image
          src="/images/logo.svg"
          alt="Blockfest Africa Logo"
          width={140}
          height={38}
          sizes="(max-width: 768px) 124px, 140px"
          priority
          className="xl:w-[140px] xl:h-[38px] xl:aspect-[140/38] aspect-[124/24] w-[124px] h-[24px] hidden md:block"
        />
      </Link>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center gap-x-[28px]">
        <Link
          href="/"
          className="text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
        >
          Home
        </Link>
        <button
          type="button"
          onClick={handleAboutClick}
          className="text-sm lg:text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
        >
          About
        </button>
        <Link
          href="/speakers"
          className="text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
        >
          Speakers
        </Link>
        <Link
          href={`mailto:${contactEmail}`}
          className="text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
        >
          Contact
        </Link>
      </nav>

      {/* Right Side */}
      <div className="flex items-center gap-x-5">
        <Link
          href={`mailto:${contactEmail}`}
          className="md:p-5 text-sm lg:text-base font-medium text-white w-fit p-3 bg-[#3D7BE8] hidden shadow-xs hover:bg-[#6597ED] h-9 px-5 py-2 md:flex items-center justify-center rounded-md transition-colors duration-300 ease-in-out"
        >
          Sponsor
        </Link>
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <BurgerIcon className="text-black" />
            </SheetTrigger>
            <SheetContent side="top">
              <MobileMenu />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};

const MobileMenu = () => {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "partnership@blockfestafrica.com";

  const router = useRouter();
  const pathname = usePathname();

  const handleAboutClick = () => {
    if (pathname === "/") {
      document.getElementById("about")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      router.push("/#about");
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
            className="p-2 rounded-full hover:bg-gray-100 transition"
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
            className="text-lg font-medium text-[#A4A4A4] hover:text-white hover:underline transition w-fit"
          >
            Home
          </Link>
        </SheetClose>

        <SheetClose asChild>
          <button
            type="button"
            onClick={handleAboutClick}
            className="text-lg font-medium text-[#A4A4A4] hover:text-white hover:underline transition w-fit"
          >
            About
          </button>
        </SheetClose>

        <SheetClose asChild>
          <Link
            href="/speakers"
            className="text-lg font-medium text-[#A4A4A4] hover:text-white hover:underline transition w-fit"
          >
            Speakers
          </Link>
        </SheetClose>

        {/* Contact mailto link */}
        <SheetClose asChild>
          <a
            href={`mailto:${contactEmail}`}
            className="text-lg font-medium text-[#A4A4A4] hover:text-white hover:underline transition w-fit"
          >
            Contact
          </a>
        </SheetClose>
      </div>
    </div>
  );
};

export default Navbar;
