"use client";
import Image from "next/image";
import { Countdown } from "@/components/countdown";
import React, { useState } from "react";
import Confetti from "react-confetti";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

export function CountdownGallerySection() {
  useSubtleAnimations();

  const [expired, setExpired] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleExpire = () => {
    setExpired(true);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 10000);
  };

  // Your gallery redirect buttons
  const galleries = [
    {
      title: "Main Event Photos",
      link: "https://drive.google.com/drive/folders/1qazNDRl38iq26pQP5YPsM1H8x9u1FcN7",
    },
    {
      title: "Mixer & Networking Event",
      link: "https://drive.google.com/drive/folders/1QcTYo1xr6h8A6HHQvU0gwxbyL_BoWBSE",
    },
  ];

  return (
    <section className="relative flex flex-col items-center justify-center px-5 py-20 lg:py-[80px] lg:px-[70px] overflow-hidden">
      {/* Confetti animation */}
      {showConfetti && <Confetti recycle={false} numberOfPieces={1000} />}

      <div className="scale-in text-center">
        {!expired ? (
          <Countdown
            targetDate={"2025-10-10T23:59:59"}
            onExpire={handleExpire}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-[#3870D3] md:w-[70%] w-full mx-auto">
            <h2 className="text-2xl md:text-5xl font-bold mb-3 text-center">
              Thank You for Being Part of Blockfest Africa!
            </h2>
            <p className="text-[15px] md:text-2xl text-gray-700 text-center">
              Your energy, ideas, and passion made this event unforgettable.
              See you at the next one!
            </p>
          </div>
        )}
      </div>

      {/* Gallery Preview Section */}
      <div className="flex flex-col gap-[7px] lg:gap-4 w-full mt-10 lg:mt-[80px] fade-in-on-scroll">
        <div className="flex flex-col md:flex-row gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[180px] md:h-[250px] lg:h-[446px] flex-1 overflow-hidden">
            <Image
              src="/images/home/img1.jpg"
              alt="Blockfest Africa event gallery image"
              width={500}
              height={446}
              sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
              priority
              className="w-full h-full object-cover object-center  rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[180px] md:h-[250px] lg:h-[446px] flex-1 overflow-hidden">
            <Image
              src="/images/home/img2.jpg"
              alt="Blockfest Africa networking event"
              width={700}
              height={446}
              sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw"
              priority
              className="w-full h-full object-cover object-center  rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[180px] md:h-[250px] lg:h-[446px] flex-1 overflow-hidden">
            <Image
              src="/images/home/img4.jpg"
              alt="Blockfest Africa conference speakers"
              width={700}
              height={446}
              sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw"
              loading="lazy"
              className="w-full h-full object-cover object-center rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[180px] md:h-[250px] lg:h-[446px] flex-1 overflow-hidden">
            <Image
              src="/images/home/imgg.jpg"
              alt="Blockfest Africa community gathering"
              width={500}
              height={446}
              sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw"
              loading="lazy"
              className="w-full h-full object-cover object-center rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>
      </div>

      <div className="mt-20 lg:mt-28 text-center fade-in-on-scroll w-full max-w-4xl">
        <h3 className="text-3xl md:text-5xl font-extrabold mb-6 text-[#1B64E4]">
          Find Event Photos Here
        </h3>
        <p className="text-gray-600 mb-12 text-base md:text-lg max-w-xl mx-auto">
          Click on any of the collections below to view and download your event photos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
          {galleries.map((gallery, index) => (
            <a
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              key={index}
              href={gallery.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center justify-center bg-[#1B64E4] text-white py-6 px-6 rounded-2xl font-semibold text-lg md:text-xl shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              <span className="z-10">{gallery.title}</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#1B64E4] to-[#3870D3] opacity-0 group-hover:opacity-100 transition duration-300" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
