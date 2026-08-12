"use client";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { marketOpportunity } from "@/lib/events";
import { EARLY_BIRD_ENDS } from "@/lib/tickets";
import "./subtle-animations.css";

export function WhyAttend2026Section() {
  useSubtleAnimations();

  /** The size of the prize, before the reasons to come. */
  const stats = [
    {
      value: `${marketOpportunity.unbankedPopulation.percentage}%`,
      label: "Nigerians Unbanked",
      note: "Prime web3 adoption potential",
    },
    {
      value: `${marketOpportunity.youngPopulation.percentage}%`,
      label: "Under 30",
      note: "Prime web3 demographic",
    },
    {
      value: `$${marketOpportunity.globalWeb3Market.value}`,
      label: "Global Web3 Market",
      note: "Africa holds a large piece",
    },
    {
      value: "30+",
      label: "African Countries",
      note: "Gateway to entire market",
    },
  ];

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
    <section className="section-y bg-paper border-t border-gray-200" id="about">
      <div className="container-page">
        {/* Header — left-aligned, on the same edge as the hero headline */}
        <div className="mb-10 max-w-2xl lg:mb-14">
          <h2 className="text-display-sm fade-in-on-scroll font-bold text-gray-900">
            Why Attend?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Three days across AI, Web3, venture capital, technology, culture and
            careers
          </p>
        </div>

        {/* Market Opportunity Stats */}
        <div className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue"
            >
              <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-gray-600">{stat.label}</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">
                {stat.note}
              </p>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="scale-in">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {categories.map((category, index) => (
              <div
                key={`${category.header}-${index}`}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors duration-300 hover:border-brand-blue md:flex-row md:items-stretch"
              >
                {/* Image Section */}
                <div className="relative h-44 w-full overflow-hidden md:h-auto md:w-2/5 md:min-h-44">
                  <Image
                    src={category.image}
                    alt={`${category.header} - Blockfest Africa benefit`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 300px"
                    loading="lazy"
                    className="object-cover object-center"
                  />
                </div>

                {/* Content Section */}
                <div className="flex flex-1 flex-col justify-center p-6">
                  <h3 className="text-lg font-semibold leading-tight text-gray-900">
                    {category.header}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 md:text-base">
                    {category.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Straight from "why" into "how much" */}
        <div className="mt-10 lg:mt-14">
          <Link
            href="/tickets"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            Get your ticket
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            Early bird pricing until {EARLY_BIRD_ENDS.display}
          </p>
        </div>
      </div>
    </section>
  );
}
