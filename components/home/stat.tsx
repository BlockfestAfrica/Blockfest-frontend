"use client";
import React from "react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

const stats = [
  { value: "4,000+", label: "Attendees" },
  { value: "20+", label: "Exhibitors" },
  { value: "20+", label: "Speakers" },
  { value: "54+", label: "Countries" },
];

export function StatsSection() {
  useSubtleAnimations();

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:space-x-3 px-25 lg:px-5 text-center py-[35px] bg-gradient-to-b lg:bg-gradient-to-r from-[#1B64E4] to-[#031940] text-white">
      {stats.map((stat, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          key={index}
          className={`flex flex-col items-center space-y-2 stagger-animation stagger-${
            index + 1
          }`}
        >
          <p className="font-medium text-[22px] lg:text-[30px] leading-[12.71px] lg:leading-[17.61px] tracking-[-5%]">
            {stat.value}
          </p>
          <p className="font-normal text-sm lg:text-[19.5px] lg:leading-[17.61px]">
            {stat.label}
          </p>
        </div>
      ))}
    </section>
  );
}
