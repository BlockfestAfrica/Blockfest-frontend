"use client";
import React, { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: "When and where is Blockfest Africa 2025?",
    answer:
      "Blockfest Africa 2025 will be held on October 11th, 2025, in Lagos, Nigeria at the Landmark Event Center. The event runs from 8:30 AM to 6:00 PM WAT.",
  },
  {
    id: 2,
    question: "Is Blockfest Africa free to attend?",
    answer:
      "Yes! Blockfest Africa is completely free to attend. Please do not pay anyone claiming to sell tickets - the event is 100% free. We believe in making Web3 education accessible to everyone.",
  },
  {
    id: 3,
    question: "How do I register and get approved?",
    answer:
      "Registration is done through our Luma platform. After registering, approval is still ongoing for all applicants. You'll receive an email confirmation if you've been approved to attend. Please be patient as we review all applications.",
  },
  {
    id: 4,
    question: "What should I expect at Blockfest Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
  },
  {
    id: 5,
    question: "Who should attend Blockfest Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
  },
  {
    id: 6,
    question: "Will there be networking opportunities?",
    answer:
      "Absolutely! Blockfest Africa is designed for maximum networking. You'll connect with founders, creators, communities, and like-minded individuals shaping Africa's Web3 ecosystem during dedicated networking sessions and breaks.",
  },
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "Yes, lunch will be provided for all registered attendees. If you have dietary restrictions or special needs, please mention them during registration so we can accommodate you.",
  },
  {
    id: 8,
    question: "What time should I arrive at the venue?",
    answer:
      "Please come early! Registration opens at 8:30 AM, and we recommend arriving by this time to check in, get settled, and secure good seats. The main program starts at 9:00 AM sharp.",
  },
  {
    id: 9,
    question: "What is the dress code for the event?",
    answer:
      "Business casual or smart casual attire is recommended. Feel comfortable while maintaining a professional appearance for networking and photos.",
  },
  {
    id: 10,
    question: "Will the event be livestreamed?",
    answer:
      "Yes! We will be livestreaming the entire event on our YouTube channel and X (Twitter) so the global Web3 community can participate virtually. Follow our social media for livestream links on event day.",
  },
  {
    id: 11,
    question: "Will there be prizes and giveaways?",
    answer:
      "Absolutely! We'll be giving away laptops, gadgets, and cash prizes through games and competitions throughout the day. Come prepared to participate and win amazing tech prizes!",
  },
  {
    id: 12,
    question: "Is transportation provided to the venue?",
    answer:
      "Yes! Free buses are provided for approved attendees from schools and specific locations in Lagos. If you've been approved, look out for our emails with transportation details and pickup points.",
  },
  {
    id: 13,
    question: "Are there accommodation discounts available?",
    answer:
      "Yes! We have special hotel and shortlet discounts for out-of-town attendees. Check the accommodation topic in our Telegram channel for exclusive deals and booking information.",
  },
  {
    id: 14,
    question: "Can I attend virtually or is it only in-person?",
    answer:
      "Blockfest Africa 2025 is an in-person event only. We believe the best connections and learning experiences happen face-to-face, especially for Africa's Web3 community.",
  },
  {
    id: 15,
    question: "How do I join the Telegram community?",
    answer:
      "Join our Telegram channel at https://t.me/blockf3stafrica for real-time updates, accommodation deals, networking, and community discussions. Stay connected with the Blockfest Africa community!",
  },
  {
    id: 16,
    question: "What safety and security measures are in place?",
    answer:
      "Your safety is our priority! The venue will be heavily guarded with professional security personnel throughout the event. We also have ambulance services and paramedics on standby for any medical emergencies.",
  },
  {
    id: 17,
    question: "Are there opportunities for startups to showcase?",
    answer:
      "Yes! Blockfest Africa provides platforms for Web3 startups and projects to showcase their innovations. Contact our team at partnership@blockfestafrica.com for showcase opportunities.",
  },
  {
    id: 18,
    question: "How can I become a sponsor or partner?",
    answer:
      "We offer various partnership tiers including Platinum, Gold, Silver, Bronze, and Community partnerships. Contact us at partnership@blockfestafrica.com to discuss sponsorship opportunities and packages.",
  },
];

interface FAQSectionProps {
  hideHeader?: boolean;
}

export function FAQSection({ hideHeader = false }: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  useSubtleAnimations();

  const toggleItem = (id: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <section className="py-20 lg:py-28 px-4 lg:px-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto">
        {!hideHeader && (
          <div className="text-center mb-12 lg:mb-16 fade-in-on-scroll">
            <h2 className="font-light text-3xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] mb-4 lg:mb-6 text-black">
              Frequently Asked <span className="text-[#F2CB45]">Questions</span>
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about Africa&apos;s premier Web3
              conference
            </p>
          </div>
        )}

        <div className="space-y-4 scale-in">
          {faqData.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <button
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors duration-200"
                onClick={() => toggleItem(item.id)}
                aria-expanded={openItems.has(item.id)}
              >
                <h3 className="font-semibold text-base lg:text-lg text-gray-900 pr-4">
                  {item.question}
                </h3>
                <div className="flex-shrink-0">
                  {openItems.has(item.id) ? (
                    <ChevronUpIcon className="w-5 h-5 text-[#1B64E4]" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {openItems.has(item.id) && (
                <div className="px-6 pb-5 transition-all duration-300 ease-in-out">
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-gray-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 lg:mt-16 text-center fade-in-on-scroll">
          <div className="bg-gradient-to-br from-[#1B64E4] to-[#3D7BE8] rounded-2xl p-8 lg:p-10 text-white">
            <h3 className="text-xl lg:text-2xl font-semibold mb-4">
              Still have questions?
            </h3>
            <p className="text-white/90 mb-6 lg:text-lg">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <a
              href="mailto:partnership@blockfestafrica.com"
              className="inline-flex items-center gap-2 bg-[#F2CB45] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#F2CB45]/90 transition-colors duration-200"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
