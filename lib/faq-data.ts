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
      "Blockf3st Africa 2026 has TWO events! Cape Town, South Africa in May 2026 and Lagos, Nigeria in October 2026. Join us for the Superbowl of Web3!",
    category: "Event Details",
  },
  {
    id: 4,
    question: "What should I expect at Blockf3st Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
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
    question: "Is Blockf3st Africa free to attend?",
    answer:
      "Yes! Blockf3st Africa is completely free to attend. Please do not pay anyone claiming to sell tickets - the event is 100% free. We believe in making Web3 education accessible to everyone.",
    category: "Registration & Tickets",
  },
  {
    id: 3,
    question: "How do I register for the events?",
    answer:
      "Registration opens closer to each event date. Follow us on social media and join our Telegram community to be the first to know when registration opens!",
    category: "Registration & Tickets",
  },
  {
    id: 5,
    question: "Who should attend Blockf3st Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
    category: "Registration & Tickets",
  },
  {
    id: 11,
    question: "Can I attend both events?",
    answer:
      "Yes! We encourage attendees to join us at both Cape Town in May and Lagos in October. Register for each event separately and experience the full Blockf3st Africa world tour!",
    category: "Registration & Tickets",
  },

  // Food & Accommodation
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "Yes, refreshments and lunch will be provided for all registered attendees. If you have dietary restrictions, please mention them during registration.",
    category: "Food & Accommodation",
  },
  {
    id: 12,
    question: "Is transportation provided to the venue?",
    answer:
      "Transportation details will be announced closer to each event. Join our Telegram community to stay updated on logistics and pickup points.",
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
      "Your safety is our priority! The venues will be guarded with professional security personnel throughout the events. We also have ambulance services and paramedics on standby for any medical emergencies.",
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
      "We offer various partnership tiers for both Cape Town and Lagos events. Contact us at partnership@blockfestafrica.com to receive our sponsorship deck with all packages and benefits.",
    category: "Community & Support",
  },
  {
    id: 19,
    question: "Can I speak at Blockf3st Africa 2026?",
    answer:
      "Speaker applications will open soon! Follow us on social media to be notified when applications open. We're looking for industry experts, founders, and thought leaders in the Web3 space.",
    category: "Community & Support",
  },
];
