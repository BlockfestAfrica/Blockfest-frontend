export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export const faqData: FAQItem[] = [
  // Event Details
  {
    id: 1,
    question: "When and where is Blockfest Africa 2025?",
    answer:
      "Blockfest Africa 2025 will be held on October 11th, 2025, in Lagos, Nigeria at the Landmark Event Center. The event runs from 8:30 AM to 6:00 PM WAT.",
    category: "Event Details",
  },
  {
    id: 4,
    question: "What should I expect at Blockfest Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
    category: "Event Details",
  },
  {
    id: 8,
    question: "What time should I arrive at the venue?",
    answer:
      "Please come early! Registration opens at 8:30 AM, and we recommend arriving by this time to check in, get settled, and secure good seats. The main program starts at 9:00 AM sharp.",
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
      "Blockfest Africa 2025 is an in-person event only. We believe the best connections and learning experiences happen face-to-face, especially for Africa's Web3 community.",
    category: "Event Details",
  },

  // Registration & Tickets
  {
    id: 2,
    question: "Is Blockfest Africa free to attend?",
    answer:
      "Yes! Blockfest Africa is completely free to attend. Please do not pay anyone claiming to sell tickets - the event is 100% free. We believe in making Web3 education accessible to everyone.",
    category: "Registration & Tickets",
  },
  {
    id: 3,
    question: "How do I register and get approved?",
    answer:
      "Registration is done through our Luma platform. After registering, approval is still ongoing for all applicants. You'll receive an email confirmation if you've been approved to attend. Please be patient as we review all applications.",
    category: "Registration & Tickets",
  },
  {
    id: 5,
    question: "Who should attend Blockfest Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
    category: "Registration & Tickets",
  },

  // Food & Accommodation
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "Yes, lunch will be provided for all registered attendees. If you have dietary restrictions or special needs, please mention them during registration so we can accommodate you.",
    category: "Food & Accommodation",
  },
  {
    id: 12,
    question: "Is transportation provided to the venue?",
    answer:
      "Yes! Free buses are provided for approved attendees from schools and specific locations in Lagos. If you've been approved, look out for our emails with transportation details and pickup points.",
    category: "Food & Accommodation",
  },
  {
    id: 13,
    question: "Are there accommodation discounts available?",
    answer:
      "Yes! We have special hotel and shortlet discounts for out-of-town attendees. Check the accommodation topic in our Telegram channel for exclusive deals and booking information.",
    category: "Food & Accommodation",
  },

  // Community & Support
  {
    id: 15,
    question: "How do I join the Telegram community?",
    answer:
      "Join our Telegram channel at https://t.me/blockf3stafrica for real-time updates, accommodation deals, networking, and community discussions. Stay connected with the Blockfest Africa community!",
    category: "Community & Support",
  },
  {
    id: 16,
    question: "What if I have more questions?",
    answer:
      "For additional questions, contact us at partnership@blockfestafrica.com or join our Telegram community. Our team is here to help make your Blockfest Africa experience amazing!",
    category: "Community & Support",
  },

  // Technical & Special Interest
  {
    id: 6,
    question: "Will there be hands-on technical workshops?",
    answer:
      "Yes! We have hands-on workshops covering smart contract development, DeFi protocols, NFT creation, and Web3 development tools. Bring your laptop and be ready to build!",
    category: "Technical & Special Interest",
  },
  {
    id: 10,
    question: "Can I pitch my startup or project at the event?",
    answer:
      "We have dedicated networking sessions and a startup showcase area. While there's no formal pitching session, you'll have plenty of opportunities to connect with investors and fellow builders.",
    category: "Technical & Special Interest",
  },
  {
    id: 11,
    question: "Are there networking opportunities for investors?",
    answer:
      "Absolutely! Blockfest Africa brings together crypto funds, angel investors, and VCs specifically interested in African Web3 projects. Special networking areas will be available.",
    category: "Technical & Special Interest",
  },
];
