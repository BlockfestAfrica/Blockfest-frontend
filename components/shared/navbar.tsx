"use client";
import Image from "next/image";
import React from "react";
import type { Menu } from "@/types";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "../ui/sheet";
// import { CiMenuBurger } from "react-icons/ci";
import { AiOutlineClose } from "react-icons/ai";
import Link from "next/link";
import BurgerIcon from "../icons/burger-icon";
import { gotham } from "@/lib/fonts";

const navbarMenu: Menu[] = [
  { title: "Home", path: "home" },
  { title: "About", path: "about" },
  { title: "Speakers", path: "speakers" },
  // removed Contact from here
];

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const Navbar = () => {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "partnership@blockfestafrica.com";

  return (
    <div
      className={`${gotham.className} bg-white md:bg-black px-5 lg:px-[70px] py-5 lg:py-10 flex items-center justify-between`}
    >
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
      <nav className="hidden md:flex items-center gap-x-[28px]">
        {navbarMenu.map((item) => (
          <button
            type="button"
            key={item.title}
            onClick={() => scrollToSection(item.path)}
            className="text-sm lg:text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
          >
            {item.title}
          </button>
        ))}

        {/* Contact mailto link */}
        <Link
          href={`mailto:${contactEmail}`}
          className="text-base font-normal text-[#A4A4A4] hover:text-white transition-colors duration-300 ease-in-out"
        >
          Contact
        </Link>
      </nav>

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
        {navbarMenu.map((item) => (
          <SheetClose asChild key={item.title}>
            <button
              type="button"
              onClick={() => scrollToSection(item.path)}
              className="text-lg font-medium text-[#A4A4A4] hover:text-white hover:underline transition w-fit"
            >
              {item.title}
            </button>
          </SheetClose>
        ))}

        {/* Contact mailto link in mobile */}
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
