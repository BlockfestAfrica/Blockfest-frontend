import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
import { FaTelegramPlane } from "react-icons/fa";
import React from "react";
import { Montserrat } from "next/font/google";
import { FaXTwitter } from "react-icons/fa6";
import Link from "next/link";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export function SpeakersGrid() {
  const Speakers = [
    {
      name: "Nduka Blessing",
      title: "CEO SOLUTIONS",
      image: "/images/speaker.webp",
      twitter: "https://twitter.com/nduka",
      telegram: "https://t.me/nduka",
      website: "https://nduka.com"
    },
    {
      name: "John Smith",
      title: "CTO INNOVATIONS",
      image: "/images/speak.webp",
      twitter: "https://twitter.com/johnsmith",
      telegram: "https://t.me/johnsmith",
      website: "https://johnsmith.dev"
    },
    {
      name: "Jane Doe",
      title: "COO ENTERPRISE",
      image: "/images/speak2.webp",
      twitter: "https://twitter.com/janedoe",
      telegram: "https://t.me/janedoe",
      website: "https://janedoe.io"
    },
    {
      name: "Alice Johnson",
      title: "Head of Strategy",
      image: "/images/speaker.webp",
      twitter: "https://twitter.com/alicejohnson",
      telegram: "https://t.me/alicejohnson",
      website: "https://alicejohnson.org"
    },
    {
      name: "Michael Brown",
      title: "Product Lead",
      image: "/images/speak2.webp",
      twitter: "https://twitter.com/michaelbrown",
      telegram: "https://t.me/michaelbrown",
      website: "https://michaelbrown.dev"
    },
    {
      name: "Robert Lee",
      title: "Software Engineer",
      image: "/images/speak.webp",
      twitter: "https://twitter.com/robertlee",
      telegram: "https://t.me/robertlee",
      website: "https://robertlee.dev"
    },
  ];

  return (
    <section className="flex flex-col items-center justify-center lg:py-[50px] lg:px-[70px] py-14 px-5">
      <h2 className="font-medium text-4xl lg:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] my-[25px] lg:my-[80px] text-black">
        Speak<span className="text-[#F2CB45]">3</span>rs
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
        {Speakers.map((speaker, index) => (
          <div
            key={index}
            className="flex md:flex-col items-center bg-white rounded-[24px] p-6 border border-[#D1D1D1] shadow-sm gap-y-6 justify-around gap-x-6"
          >
            <Image
              src={speaker.image}
              alt={speaker.name}
              width={280}
              height={280}
              priority
              className="object-cover rounded-full h-[130px] w-[130px] md:h-[280px] md:w-[280px]"
            />
            <div className="flex flex-col items-center gap-y-6">
              <div className="flex flex-col gap-y-2 items-center">
                <h3 className={`${montserrat.className} md:text-[30px] text-[22px] font-semibold`}>
                  {speaker.name}
                </h3>
                <p className={`${montserrat.className} md:text-[20px] text-sm font-medium text-[#A4A4A4]`}>
                  {speaker.title}
                </p>
              </div>
              <div className="inline-flex gap-x-5 items-center">
                <Link
                  href={speaker.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform duration-200 hover:-translate-y-1"
                >
                  <FaXTwitter size={20} />
                </Link>
                <Link
                  href={speaker.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform duration-200 hover:-translate-y-1"
                >
                  <CiGlobe size={20} />
                </Link>
                <Link
                  href={speaker.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform duration-200 hover:-translate-y-1"
                >
                  <FaTelegramPlane size={20} />
                </Link>
              </div>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}
