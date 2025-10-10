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

  return (
    <section className="relative flex flex-col items-center justify-center px-5 py-20 lg:py-[80px] lg:px-[70px] overflow-hidden">
      {/* Confetti animation */}
      {showConfetti && <Confetti recycle={false} numberOfPieces={1000} />}

      <div className="scale-in text-center">
        {!expired ? (
          <Countdown targetDate={"2025-10-10T23:59:59"} onExpire={handleExpire} />
        ) : (
          <div className="flex flex-col items-center text-[#3870D3] animate-bounce">
            <h2 className="text-3xl md:text-5xl font-bold mb-3">
              🎉 The Wait Is Over! 🎉
            </h2>
            <p className="text-base md:text-2xl text-gray-700">
              Blockfest Africa is happening — let’s make history together!
            </p>
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="flex flex-col gap-[7px] lg:gap-4 w-full mt-10 lg:mt-[80px] fade-in-on-scroll">
        <div className="flex gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] md:h-[250px] flex-1 basis-[40%] overflow-hidden">
            <Image
              src="/images/img4.webp"
              alt="Blockfest Africa event gallery image"
              width={500}
              height={446}
              sizes="(min-width: 1024px) 40vw, (min-width: 768px) 35vw, 50vw"
              priority
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] md:h-[250px] flex-1 basis-[60%] overflow-hidden">
            <Image
              src="/images/img7.webp"
              alt="Blockfest Africa networking event"
              width={700}
              height={446}
              sizes="(min-width: 1024px) 60vw, (min-width: 768px) 55vw, 50vw"
              priority
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>

        <div className="flex gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] md:h-[250px] flex-1 basis-[60%] overflow-hidden">
            <Image
              src="/images/img-3.webp"
              alt="Blockfest Africa conference speakers"
              width={700}
              height={446}
              sizes="(min-width: 1024px) 60vw, (min-width: 768px) 55vw, 50vw"
              loading="lazy"
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] md:h-[250px] flex-1 basis-[40%] overflow-hidden">
            <Image
              src="/images/img1.webp"
              alt="Blockfest Africa community gathering"
              width={500}
              height={446}
              sizes="(min-width: 1024px) 40vw, (min-width: 768px) 35vw, 50vw"
              loading="lazy"
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
