import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
import { FaTelegramPlane } from "react-icons/fa";
import React from "react";
import { Montserrat } from "next/font/google";
import { FaXTwitter } from "react-icons/fa6";
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
export function SpeakersGrid() {
  const Speakers = [
    { name: "Nduka Blessing", title: "CEO SOLUTIONS", image: "/images/speaker.webp" },
    { name: "John Smith", title: "CTO INNOVATIONS", image: "/images/speaker.webp" },
    { name: "Jane Doe", title: "COO ENTERPRISE", image: "/images/speaker.webp" },
    { name: "Alice Johnson", title: "Head of Strategy", image: "/images/speaker.webp" },
    { name: "Michael Brown", title: "Product Lead", image: "/images/speaker.webp" },
    { name: "Sophia Davis", title: "Marketing Director", image: "/images/speaker.webp" },
    { name: "David Wilson", title: "AI Researcher", image: "/images/speaker.webp" },
    { name: "Emily Clark", title: "UX Designer", image: "/images/speaker.webp" },
    { name: "Robert Lee", title: "Software Engineer", image: "/images/speaker.webp" },
  ];

  return (
    <section className="flex flex-col items-center justify-center lg:py-[80px] lg:px-[70px] py-14 px-5">
      <h2 className="font-medium text-4xl lg:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] my-[25px] lg:my-[80px] text-black">
        Speak<span className="text-[#F2CB45]">3</span>rs
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full ">
        {Speakers.map((speaker, index) => (
          <div
            key={index}
            className="flex flex-col items-center bg-white rounded-[24px] p-6 border border-[#D1D1D1] shadow-sm gap-y-6"
          >
            <Image
              src={speaker.image}
              alt={speaker.name}
              width={280}
              height={280}
              priority
              className=" object-cover rounded-full "
            />
            <div className="flex flex-col gap-y-2 items-center">
              <h3 className={`${montserrat.className} text-[30px] font-semibold `}>{speaker.name}</h3>
              <p className={`${montserrat.className} text-[20px] font-medium text-[#A4A4A4] `}>{speaker.title}</p>
            </div>
            <div className="inline-flex gap-x-5 items-center ">
              <FaXTwitter size={23} />
              <CiGlobe size={23} />
              <FaTelegramPlane size={23} />
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}
