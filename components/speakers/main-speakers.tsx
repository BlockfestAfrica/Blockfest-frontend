import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
import React from "react";
import { Montserrat } from "next/font/google";
import { FaXTwitter } from "react-icons/fa6";
import Link from "next/link";
import { SpeakersList } from "@/lib/speakers";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export function SpeakersGrid() {
  return (
    <section className="flex flex-col items-center justify-center lg:py-[30px] lg:px-[70px] py-10 px-5">
      <h2 className="font-medium text-4xl lg:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] my-[25px] lg:my-[80px] text-black">
        Speak<span className="text-[#F2CB45]">3</span>rs
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
        {SpeakersList.map((speaker, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            key={index}
            className="flex md:flex-col items-center bg-white rounded-[24px] p-3 md:p-6 border border-[#D1D1D1] shadow-sm gap-y-6 justify-around"
          >
            <div className="relative shrink-0 w-[120px] h-[120px] sm:w-[150px] rounded-full sm:h-[150px] md:w-[280px] md:h-[280px] overflow-hidden">
              <Image
                src={speaker.image}
                alt={speaker.name}
                fill
                className="object-center"
                quality={85}
                priority
                sizes="(min-width: 768px) 280px, (min-width: 640px) 120px, 150px"
              />
            </div>

            <div className="flex flex-col items-center gap-y-4">
              <div className="flex flex-col gap-y-2 items-center text-center">
                <h3
                  className={`${montserrat.className} md:text-[29px] text-lg font-semibold`}
                >
                  {speaker.name}
                </h3>
                <p
                  className={`${montserrat.className} md:text-[20px] text-[15px] font-medium text-[#A4A4A4] w-[85%] md:w-full`}
                >
                  {speaker.title}
                </p>
              </div>

              {/*shows only when twitter is provided */}
              <div className="inline-flex gap-x-5 items-center">
                {speaker.twitter && (
                  <Link
                    href={speaker.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform duration-200 hover:-translate-y-1"
                  >
                    <FaXTwitter size={20} />
                  </Link>
                )}
                {/*shows only when website is provided */}
                {speaker.website && (
                  <Link
                    href={speaker.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform duration-200 hover:-translate-y-1"
                  >
                    <CiGlobe size={20} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
