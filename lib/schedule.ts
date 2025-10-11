export type AgendaItem = {
  id: string;
  time: string;
  title: string;
  description: string[];
  speaker?: string;
  type:
    | "keynote"
    | "lecture"
    | "break"
    | "networking"
    | "workshop"
    | "panel"
    | "talk"
    | "performance"
    | "pitch"
    | "activity"
    | "sponsor"
    | "partner"
    | "address"
    | "fireside"
    | "wrap-up";
  duration?: number; // duration in minutes
};

export const agendaItems: AgendaItem[] = [
  {
    id: "networking-checkin",
    time: "8:00 - 8:55 AM",
    title: "Morning Networking & Check-in + Welcome Refreshments",
    description: [
      "Informal networking session with light music and sponsor booths open.",
      "Badge collection and welcome refreshments available across all halls.",
    ],
    type: "networking",
    duration: 55,
  },
  {
    id: "opening-remarks",
    time: "9:00 - 9:05 AM",
    title: "Official Opening Remarks",
    description: [
      "Opening address by the Programs Director and hosts.",
      "Setting the tone for the day’s sessions.",
    ],
    type: "address",
    duration: 5,
  },
  {
    id: "beyond-h1b",
    time: "9:05 - 9:13 AM",
    title: "Beyond H-1B: Building Global Tech Careers from Africa",
    speaker: "Idris Olubisi",
    description: [
      "Lightning talk on creating international career opportunities from Africa.",
    ],
    type: "talk",
    duration: 8,
  },
  {
    id: "audience-interaction-1",
    time: "9:15 - 9:22 AM",
    title: "Audience Interaction #1",
    description: [
      "Fun ice-breaker activity to energize participants and spark engagement.",
    ],
    type: "activity",
    duration: 7,
  },
  {
    id: "headline-sponsor-1",
    time: "9:25 - 9:40 AM",
    title: "Headline Sponsor Spotlight #1 (Jeroid)",
    description: [
      "15-minute brand showcase by Jeroid highlighting innovations and opportunities.",
    ],
    type: "sponsor",
    duration: 15,
  },
  {
    id: "panel-1",
    time: "09:42 - 10:12 AM",
    title:
      "Panel 1: Code or Lead? Redefining the Roles of Founders and Developers in Africa's Tech Ecosystem",
    description: [
      "Panel discussion with 5 expert panelists exploring the balance between leadership and technical innovation.",
    ],
    type: "panel",
    duration: 30,
  },
  {
    id: "keynote-youth-future",
    time: "10:13 - 10:23 AM",
    title:
      "Keynote: From Potential to Power: Unleashing Youth for Africa's Decentralized Future",
    speaker: "Hon. Mobolaji Ogunlende Abubakre",
    description: [
      "Keynote on empowering African youth in the decentralized economy from the Commissioner of Youth & Social Development, LASG",
    ],
    type: "keynote",
    duration: 10,
  },
  {
    id: "sponsor-spotlight-1",
    time: "10:23 - 10:43 AM",
    title: "Gold & Silver Sponsor Spotlights (Hyperbridge, Gidi & Jupiter)",
    description: [
      "10 minutes for Gold sponsor (Hyperbridge), 5 minutes each for Silver sponsors (Gidi & Jupiter).",
    ],
    type: "sponsor",
    duration: 20,
  },
  {
    id: "panel-2",
    time: "10:45 - 11:15 AM",
    title:
      "Panel 2: Funding the Platform - What It Takes to Raise as a Web3 Builder in Africa",
    description: [
      "Panel discussion with 5 ecosystem leaders on funding strategies for Web3 builders.",
    ],
    type: "panel",
    duration: 30,
  },
  {
    id: "short-performance",
    time: "11:17 - 11:27 AM",
    title: "Short Performance",
    description: [
      "Live performance featuring music, spoken word, or cultural showcase.",
    ],
    type: "performance",
    duration: 10,
  },
  {
    id: "block-by-block",
    time: "11:33 - 11:40 AM",
    title: "Block by Block: How Web3 Education is Building Africa’s Future",
    speaker: "Sarah Idahosa",
    description: [
      "Lightning talk on how blockchain education is shaping Africa’s next generation.",
    ],
    type: "talk",
    duration: 7,
  },
  {
    id: "welcome-keynote-xeus",
    time: "11:42 - 12:00 PM",
    title:
      "Welcome Keynote: From Pipeline to Platform - The Web3 Playbook for Africans",
    speaker: "Samuel Olaoyenikan, Convener of B3A",
    description: [
      "Vision-setting keynote presenting a roadmap for Africa’s Web3 ecosystem.",
    ],
    type: "keynote",
    duration: 18,
  },
  {
    id: "product-pitch-1",
    time: "12:05 - 12:15 PM",
    title: "Product Pitch (x3)",
    description: [
      "Three projects present their innovative products (3 minutes each).",
    ],
    type: "pitch",
    duration: 10,
  },
  {
    id: "audience-game-1",
    time: "12:16 - 12:25 PM",
    title: "Audience Game Session ",
    description: [
      "Interactive trivia or mini-challenge session with exciting giveaways.",
    ],
    type: "activity",
    duration: 9,
  },
  {
    id: "fireside-chat",
    time: "12:25 - 12:55 PM",
    title:
      "Fireside Chat: Regulation in Web3 - What Builders Need to Know in Nigeria",
    speaker: "Emomotimi Agama, DG of Nigeria’s SEC",
    description: [
      "In-depth discussion with the DG of Nigeria’s SEC on blockchain policy and compliance.",
    ],
    type: "fireside",
    duration: 30,
  },
  {
    id: "headline-sponsor-2",
    time: "12:57 - 1:12 PM",
    title: "Gold & Silver Sponsor Spotlight (Cake Wallet & SUI Blockchain)",
    description: [
      "10 minutes for Gold sponsor (Cake Wallet), 5 minutes for Silver sponsor (SUI Blockchain).",
    ],
    type: "sponsor",
    duration: 15,
  },
  {
    id: "lunch-break",
    time: "1:15 - 2:15 PM",
    title: "Lunch Break + Networking + Booth Visits + Group Photo",
    description: [
      "Relax and network over lunch while exploring sponsor booths.",
      "Don’t miss the group photo session!",
    ],
    type: "break",
    duration: 60,
  },
  {
    id: "audience-interaction-2",
    time: "2:15 - 2:20 PM",
    title: "Audience Interaction",
    description: [
      "Quick ice-breaker activity to kick off the afternoon sessions.",
    ],
    type: "activity",
    duration: 5,
  },
  {
    id: "fanyogo-display",
    time: "2:21 - 2:22 PM",
    title: "FanYogo Video Display",
    description: ["Short promotional video showcasing FanYogo partnership."],
    type: "partner",
    duration: 1,
  },
  {
    id: "sponsor-spotlight-2",
    time: "2:22 - 2:32 PM",
    title: "Silver Sponsor Spotlight (Somnia Africa)",
    description: ["5 minutes spotlight for Silver sponsor (Somnia Africa)."],
    type: "sponsor",
    duration: 10,
  },
  {
    id: "privacy-future",
    time: "2:32 - 2:42 PM",
    title: "A Privacy Preserving Future",
    speaker: "Olayinka Oshidipe",
    description: [
      "Lightning talk exploring privacy and decentralization trends.",
    ],
    type: "talk",
    duration: 10,
  },
  {
    id: "panel-3",
    time: "2:47 - 3:17 PM",
    title:
      "Panel 3: Brand, Influence & Community - Creatives at the Web2-Web3 Crossroads",
    description: [
      "Discussion with creators, marketers, and founders bridging digital culture.",
    ],
    type: "panel",
    duration: 30,
  },
  {
    id: "product-pitch-2",
    time: "3:20 - 3:26 PM",
    title: "Product Pitch (x2)",
    description: [
      "Two projects present final product spotlights (3 minutes each).",
    ],
    type: "pitch",
    duration: 6,
  },
  {
    id: "panel-4",
    time: "3:30 - 4:00 PM",
    title: "Panel 4: Clarity in Compliance",
    description: [
      "Top ecosystem leaders discuss blockchain policy and compliance clarity in Nigeria.",
    ],
    type: "panel",
    duration: 30,
  },
  {
    id: "audience-game-2",
    time: "4:03 - 4:13 PM",
    title: "Audience Game Session",
    description: [
      "Interactive Q&A or ‘Guess That Chain’ session with fun prizes.",
    ],
    type: "activity",
    duration: 10,
  },
  {
    id: "sponsor-spotlight-3",
    time: "4:13 - 4:38 PM",
    title: "Silver Sponsor Spotlights (Avax Nigeria & Base Africa Projects)",
    description: [
      "5 minutes for Avax Nigeria; 3 minutes each for four Base Africa projects.",
    ],
    type: "sponsor",
    duration: 25,
  },
  {
    id: "raffle",
    time: "4:40 - 5:00 PM",
    title: "Gadgets Raffle and Presentation",
    description: [
      "Exciting raffle draw and prize presentation by the core team and iGadgets.",
    ],
    type: "activity",
    duration: 20,
  },
  {
    id: "closing-remarks",
    time: "5:00 - 5:05 PM",
    title: "Closing Remarks",
    description: ["Vote of thanks delivered by the partnership lead."],
    type: "address",
    duration: 5,
  },
  {
    id: "closing-announcements",
    time: "5:05 - 5:10 PM",
    title: "Closing Announcements",
    description: [
      "Final thank-you notes and dance session to close out the event.",
    ],
    type: "wrap-up",
    duration: 5,
  },
];

// Utility functions for schedule data
export const getTotalDuration = (): number => {
  return agendaItems.reduce((total, item) => total + (item.duration || 0), 0);
};

export const getItemsByType = (type: AgendaItem["type"]): AgendaItem[] => {
  return agendaItems.filter((item) => item.type === type);
};

export const formatScheduleTime = (time: string): string => {
  return time.replace(/(\d+):(\d+)\s*-\s*(\d+):(\d+)(\w+)/, "$1:$2 - $3:$4 $5");
};
