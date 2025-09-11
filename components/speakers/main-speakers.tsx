import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
// import { FaTelegramPlane } from "react-icons/fa";
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
      name: "Jeremiah Mayowa",
      title: "CEO JEROID",
      image: "/images/speakers/Jeroidceo.jpg",
      twitter: "https://x.com/belikejeroid?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
      website: "https://jeroid.co/"
    },
    {
      name: "Ayodeji Awisika (Ebunayo)",
      title: "FOUNDER WEB3BRIDGE",
      image: "/images/speakers/ebunayo.jpg",
      twitter: "https://x.com/ebunayo08?s=21&t=6lhy88Nx16NRD-zFs2-S9w",
      website: "https://www.web3bridgeafrica.com/"
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
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            key={index}
            className="flex md:flex-col items-center bg-white rounded-[24px] p-3 md:p-6 border border-[#D1D1D1] shadow-sm gap-y-6 justify-around gap-x-6"
          >
            <Image
              src={speaker.image}
              alt={speaker.name}
              width={250}
              height={250}
              priority
              className="object-cover rounded-full h-[140px] w-[140px] md:h-[250px] md:w-[250px] aspect-square"
              sizes="(max-width: 768px) 140px, 250px"
              quality={85}
            />
            <div className="flex flex-col items-center gap-y-6 ">
              <div className="flex flex-col gap-y-2 items-center text-center">
                <h3 className={`${montserrat.className} md:text-[30px] text-[22px] font-semibold `}>
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
                {/* <Link
                  href={speaker.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform duration-200 hover:-translate-y-1"
                >
                  <FaTelegramPlane size={20} />
                </Link> */}
              </div>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}
