"use client";
import { Montserrat } from "next/font/google";
import Image from "next/image";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
export function WhyAttendSection() {
  useSubtleAnimations();

  return (
    <section
      className="flex flex-col items-center justify-center px-4 py-12 lg:py-16 lg:px-8 bg-gradient-to-b from-brand-blue to-brand-blue-dark"
      id="about"
    >
      <div className="inline-flex items-center gap-2 bg-white/[0.07] rounded-full px-4 py-2 mb-4 border border-white/20">
        <span className="text-white font-semibold text-sm">
          WHY BLOCKF3ST
        </span>
      </div>
      <h2 className="font-bold text-3xl lg:text-5xl mb-6 lg:mb-10 text-white fade-in-on-scroll">
        Why Attend<span className="text-white">?</span>
      </h2>
      <div className="scale-in">
        <FeaturesComp />
      </div>
    </section>
  );
}

function FeaturesComp() {
  const categories = [
    {
      image: "/images/home/img4.jpg",
      header: "Africa's Web3 SuperBowl",
      text: "Blockchain Africa is not just an event, it's a movement. When Africa throws a party, the world tunes in. Get ready for Web3 like never before.",
    },
    {
      image: "/images/home/img9.jpg",
      header: "Live Panels & Masterclasses",
      text: "Hear from the continent's boldest builders, creators, and thinkers. Dive into sessions that go beyond talk but straight into action.",
    },
    {
      image: "/images/home/img10.jpg",
      header: "Founders, Creators & Communities",
      text: "From your first NFT to your next big Web3 project, Blockfest connects the minds shaping Africa’s digital frontier.",
    },
    {
      image: "/images/home/img3.jpg",
      header: "Buidl • Bridge • Become",
      text: "These aren't just themes , they're a roadmap to unlocking Africa's blockchain potential.",
    },
    {
      image: "/images/home/img6.jpg",
      header: "Your Web3 Journey Starts Here",
      text: " Whether you're a curious newcomer or a seasoned pro, Blockfest is your gateway to the future of Africa's digital economy.",
    },
    {
      image: "/images/home/img5.jpg",
      header: "For Builders, Dreamers & Doers",
      text: "Web3 isn’t for someday. It’s now. Join a community of disruptors turning vision into products, code, and movements.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-5xl w-full">
      {categories.map((category, index) => (
        <div
          key={`${category.header}-${index}`}
          className="flex flex-col md:flex-row items-stretch bg-white rounded-xl lg:rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
        >
          {/* Image Section */}
          <div className="w-full md:w-[40%]">
            <div className="relative w-full h-[160px] md:h-full min-h-[160px] overflow-hidden">
              <Image
                src={category.image}
                alt={`${category.header} - Blockfest Africa benefit`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 40vw, 300px"
                loading="lazy"
                className="object-cover object-center "
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex flex-col justify-center flex-1 text-left p-4">
            <h3 className="text-brand-blue font-medium text-lg md:text-xl lg:text-2xl leading-tight mb-1 lg:mb-2">
              {category.header}
            </h3>
            <p
              className={`${montserrat.className} text-gray-500 text-xs md:text-sm lg:text-base leading-relaxed`}
            >
              {category.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
