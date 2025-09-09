import Image from "next/image";
import { Countdown } from "@/components/countdown";
import React from "react";

export function CountdownGallerySection() {
  return (
    <section className="flex flex-col items-center justify-center px-5 py-20 lg:py-[80px] lg:px-[70px]">
      <Countdown targetDate={"2025-10-11T23:59:59"} />

      <div className="flex flex-col gap-[7px] lg:gap-4 w-full mt-10 lg:mt-[80px]">
        <div className="flex gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] flex-1 basis-[40%] overflow-hidden">
            <Image
              src="/images/img4.webp"
              alt="Blockfest Africa event gallery image"
              width={500}
              height={446}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 500px"
              priority
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] flex-1 basis-[60%] overflow-hidden">
            <Image
              src="/images/img7.webp"
              alt="Blockfest Africa networking event"
              width={700}
              height={446}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 700px"
              priority
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>

        <div className="flex gap-[7px] lg:gap-4">
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] flex-1 basis-[60%] overflow-hidden">
            <Image
              src="/images/img-3.webp"
              alt="Blockfest Africa conference speakers"
              width={700}
              height={446}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 700px"
              loading="lazy"
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
          <div className="bg-gray-300 rounded-[8px] lg:rounded-[24px] h-[148px] lg:h-[446px] flex-1 basis-[40%] overflow-hidden">
            <Image
              src="/images/img1.webp"
              alt="Blockfest Africa community gathering"
              width={500}
              height={446}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 500px"
              loading="lazy"
              className="w-full h-full object-cover object-center scale-115 rounded-[8px] lg:rounded-[24px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
