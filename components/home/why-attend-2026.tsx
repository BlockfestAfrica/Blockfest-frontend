"use client";
import Image from "next/image";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { marketOpportunity } from "@/lib/events";
import { EARLY_BIRD_ENDS } from "@/lib/tickets";
import { gotham } from "@/lib/fonts";
import "./subtle-animations.css";

export function WhyAttend2026Section() {
  useSubtleAnimations();

  const categories = [
    {
      image: "/images/home/img4.jpg",
      header: "The Superbowl of Web3",
      text: "Blockf3st Africa represents the biggest gathering of Web3 minds on the continent. It is where the next generation of builders are inspired.",
    },
    {
      image: "/images/home/img9.jpg",
      header: "Connect",
      text: "Connect with amazing like minds who want to change what web3 offers to Africa. Network with founders, investors, and government officials.",
    },
    {
      image: "/images/home/img10.jpg",
      header: "Learn",
      text: "Learn about various cutting edge technologies utilized by web3 companies around the world through live panels and masterclasses.",
    },
    {
      image: "/images/home/img3.jpg",
      header: "Build",
      text: "Be inspired by sessions, and go on to build the next unicorn solution for a ready African and global market.",
    },
    {
      image: "/images/home/img6.jpg",
      header: "Access Africa's $3.3Tn Web3 Market",
      text: "70% of attendees are decision makers from founders to government officials. Direct access to Africa's top web3 talent pool.",
    },
    {
      image: "/images/home/img5.jpg",
      header: "Government Backing",
      text: "Blockf3st Africa has policy influence and government backing. Year-round community engagement, not just a single day event.",
    },
  ];

  return (
    <section
      className="flex flex-col items-center justify-center px-5 py-12 lg:py-16 lg:px-10 bg-gradient-to-b from-gray-50 to-white"
      id="about"
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="font-bold text-4xl lg:text-5xl xl:text-6xl mb-4 text-gray-900 fade-in-on-scroll">
            Why Attend?
          </h2>
          <p className="text-gray-500 text-base lg:text-lg max-w-3xl mx-auto px-5">
            Three days across AI, Web3, venture capital, technology, culture
            and careers
          </p>
        </div>

        {/* Market Opportunity Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-12">
          <div className="bg-white rounded-xl p-3 lg:p-4 text-center border border-gray-200 shadow-sm">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-blue">
              {marketOpportunity.unbankedPopulation.percentage}%
            </p>
            <p className="text-gray-700 text-xs lg:text-sm mt-1">
              Nigerians Unbanked
            </p>
            <p className="text-gray-500 text-[10px] lg:text-xs mt-1 hidden sm:block">
              Prime web3 adoption potential
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 text-center border border-gray-200 shadow-sm">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-blue">
              {marketOpportunity.youngPopulation.percentage}%
            </p>
            <p className="text-gray-700 text-xs lg:text-sm mt-1">Under 30</p>
            <p className="text-gray-500 text-[10px] lg:text-xs mt-1 hidden sm:block">
              Prime web3 demographic
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 text-center border border-gray-200 shadow-sm">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-blue">
              ${marketOpportunity.globalWeb3Market.value}
            </p>
            <p className="text-gray-700 text-xs lg:text-sm mt-1">
              Global Web3 Market
            </p>
            <p className="text-gray-500 text-[10px] lg:text-xs mt-1 hidden sm:block">
              Africa holds a large piece
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 text-center border border-gray-200 shadow-sm">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-blue">
              30+
            </p>
            <p className="text-gray-700 text-xs lg:text-sm mt-1">
              African Countries
            </p>
            <p className="text-gray-500 text-[10px] lg:text-xs mt-1 hidden sm:block">
              Gateway to entire market
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="scale-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {categories.map((category, index) => (
              <div
                key={`${category.header}-${index}`}
                className="flex flex-col md:flex-row items-stretch bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 transition-shadow duration-300 overflow-hidden"
              >
                {/* Image Section */}
                <div className="w-full md:w-[40%]">
                  <div className="relative w-full h-[180px] md:h-full min-h-[180px] overflow-hidden">
                    <Image
                      src={category.image}
                      alt={`${category.header} - Blockfest Africa benefit`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 300px"
                      loading="lazy"
                      className="object-cover object-center"
                    />
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-col justify-center flex-1 text-left p-5 md:p-4">
                  <h3 className="text-brand-blue font-semibold text-lg md:text-xl lg:text-2xl xl:text-3xl leading-tight mb-2">
                    {category.header}
                  </h3>
                  <p
                    className={`${gotham.className} text-gray-600 text-sm md:text-base leading-relaxed`}
                  >
                    {category.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Straight from "why" into "how much" */}
        <div className="mt-10 text-center">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-brand-blue-pressed"
          >
            Get your ticket
            <FaArrowRight className="text-xs" />
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            Early bird pricing until {EARLY_BIRD_ENDS.display}
          </p>
        </div>
      </div>
    </section>
  );
}
