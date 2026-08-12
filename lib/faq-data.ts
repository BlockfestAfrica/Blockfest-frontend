export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export const faqCategories = [
  { name: "Event Details", icon: "📅", color: "bg-blue-50 text-blue-700" },
  {
    name: "Registration & Tickets",
    icon: "🎫",
    color: "bg-green-50 text-green-700",
  },
  {
    name: "Food & Accommodation",
    icon: "🍽️",
    color: "bg-orange-50 text-orange-700",
  },
  {
    name: "Activities & Networking",
    icon: "🤝",
    color: "bg-purple-50 text-purple-700",
  },
  { name: "Safety & Security", icon: "🔒", color: "bg-red-50 text-red-700" },
  {
    name: "Community & Support",
    icon: "💬",
    color: "bg-indigo-50 text-indigo-700",
  },
] as const;

export const faqData: FAQItem[] = [
  // Event Details
  {
    id: 1,
    question: "When and where is Blockf3st Africa 2026?",
    answer:
      "October 22–24, 2026 at the National Art Theatre, Lagos. Three days: the workshop and The Back Room, the main conference, then the closing mixer.",
    category: "Event Details",
  },
  {
    id: 4,
    question: "What should I expect at Blockf3st Africa?",
    answer:
      "Keynotes, workshops, panels, founder and investor sessions, startup showcases and networking across AI, Web3, fintech, infrastructure, media and culture. The full schedule lands in the coming weeks.",
    category: "Event Details",
  },
  {
    id: 8,
    question: "What time should I arrive at the venue?",
    answer:
      "Please come early! Registration opens at 8:00 AM, and we recommend arriving by this time to check in, get settled, and secure good seats. The main program starts at 8:30 AM sharp.",
    category: "Event Details",
  },
  {
    id: 9,
    question: "What is the dress code for the event?",
    answer:
      "Business casual or smart casual attire is recommended. Feel comfortable while maintaining a professional appearance for networking and photos.",
    category: "Event Details",
  },
  {
    id: 14,
    question: "Can I attend virtually or is it only in-person?",
    answer:
      "We will be livestreaming on our YouTube channel and X (Twitter) so the global Web3 community can participate virtually. However, we strongly encourage in-person attendance for the best networking and learning experience.",
    category: "Event Details",
  },

  // Registration & Tickets
  {
    id: 2,
    question: "How much does it cost to attend Blockf3st Africa '26?",
    answer:
      "Passes run from ₦7,500 (BUIDL PASS) to ₦185,000 (ALL ACCESS PASS), with early bird pricing until August 30, 2026. See all ten on our tickets page. Only buy through our official ticket link, and please do not pay anyone else claiming to sell tickets.",
    category: "Registration & Tickets",
  },
  {
    id: 3,
    question: "How do I get a ticket?",
    answer:
      "Pick your pass on the tickets page and you will be taken to our official ticket platform to check out. Early bird pricing ends August 30, 2026.",
    category: "Registration & Tickets",
  },
  {
    id: 20,
    question: "Can I get a refund or transfer my ticket?",
    answer:
      "Tickets are non-refundable but transferable until October 16, 2026 at 6:00 PM WAT. Refunds are not provided for no-shows.",
    category: "Registration & Tickets",
  },
  {
    id: 21,
    question: "What happens at the Day 1 workshop?",
    answer:
      "A curated room of hands-on sessions with leading experts across development, design, marketing and community. It runs on the morning of October 22 and comes with breakfast. BUIDL PLUS, BECOME PLUS, EXEC PASS and ALL ACCESS PASS all include it.",
    category: "Registration & Tickets",
  },
  {
    id: 22,
    question: "What is The Back Room?",
    answer:
      "A closed-door room on the evening of October 22, away from the main crowd, where founders pitch for funding and meet angel investors, fund managers and VCs directly. Access comes with the FOUNDER CIRCLE and ALL ACCESS PASS.",
    category: "Registration & Tickets",
  },
  {
    id: 23,
    question: "Can I buy tickets for my team?",
    answer:
      "Yes. The CORPORATE CIRCLE is ₦150,000 (down from ₦175,000) and covers five people with BECOME PASS access: main stage, exhibition area, lunch and event merch for each.",
    category: "Registration & Tickets",
  },
  {
    id: 5,
    question: "Who should attend Blockf3st Africa?",
    answer:
      "Founders, engineers, investors, creators, corporate leaders, policymakers, designers, marketers, students and emerging talent. See the full breakdown on our tickets page.",
    category: "Registration & Tickets",
  },
  {
    id: 11,
    question: "Which pass should I get?",
    answer:
      "It depends on which days you want. Conference day alone starts with the BUIDL PASS. Add the Day 1 workshop with BUIDL PLUS or BECOME PLUS. FOUNDER CIRCLE gets you into The Back Room. PRIME, EXEC and ALL ACCESS add VIP entry and the speakers lounge, and ALL ACCESS adds the Day 3 mixer.",
    category: "Registration & Tickets",
  },

  // Food & Accommodation
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "It depends on your pass. Breakfast on Day 1 comes with every workshop pass. Lunch is included from the BRIDGE PASS upwards, and PRIME, EXEC and ALL ACCESS get the buffet lunch. Note any dietary restrictions at checkout.",
    category: "Food & Accommodation",
  },
  {
    id: 12,
    question: "Is transportation provided to the venue?",
    answer:
      "Transportation may be provided within Lagos. At checkout you will be asked which area you are travelling from (Ikeja, Surulere, Yaba, Ikorodu, Festac, Iyana Ipaja, Berger or Ajah) so we can plan pickup points. Join our Telegram community for logistics updates.",
    category: "Food & Accommodation",
  },
  {
    id: 13,
    question: "Are there accommodation discounts available?",
    answer:
      "Yes! We have special hotel and shortlet discounts for out-of-town attendees. Check the accommodation topic in our Telegram channel for exclusive deals and booking information.",
    category: "Food & Accommodation",
  },

  // Activities & Networking
  {
    id: 6,
    question: "Will there be networking opportunities?",
    answer:
      "Absolutely! Blockf3st Africa is designed for maximum networking. You'll connect with founders, creators, communities, and like-minded individuals shaping Africa's Web3 ecosystem during dedicated networking sessions and breaks.",
    category: "Activities & Networking",
  },
  {
    id: 10,
    question: "Will the event be livestreamed?",
    answer:
      "Yes! We will be livestreaming the entire event on our YouTube channel and X (Twitter) so the global Web3 community can participate virtually. Follow our social media for livestream links.",
    category: "Activities & Networking",
  },
  {
    id: 17,
    question: "Are there opportunities for startups to showcase?",
    answer:
      "Yes! Blockf3st Africa provides platforms for Web3 startups and projects to showcase their innovations. Contact our team at partnership@blockfestafrica.com for showcase opportunities.",
    category: "Activities & Networking",
  },

  // Safety & Security
  {
    id: 16,
    question: "What safety and security measures are in place?",
    answer:
      "The venue is guarded by professional security personnel throughout the event, with ambulance services and paramedics on standby.",
    category: "Safety & Security",
  },

  // Community & Support
  {
    id: 15,
    question: "How do I join the community?",
    answer:
      "Join our Telegram channel at t.me/blockf3stafrica for real-time updates, networking, and community discussions. Follow us on X (Twitter) @blockfestafrica for announcements.",
    category: "Community & Support",
  },
  {
    id: 18,
    question: "How can I become a sponsor or partner?",
    answer:
      "We offer several partnership tiers for Lagos '26. Contact us at partnership@blockfestafrica.com for the sponsorship deck.",
    category: "Community & Support",
  },
  {
    id: 19,
    question: "Can I speak at Blockf3st Africa 2026?",
    answer:
      "Speaker applications open in the coming weeks. Follow us on social media to be notified. We are looking for industry experts, founders and thought leaders across AI and Web3.",
    category: "Community & Support",
  },
];
