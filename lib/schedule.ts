export type AgendaItem = {
  id: string;
  time: string;
  title: string;
  description: string[];
  speaker?: string;
  type: "keynote" | "lecture" | "break" | "networking" | "workshop";
  duration?: number; // duration in minutes
};

export const agendaItems: AgendaItem[] = [
  {
    id: "registration",
    time: "8:30 - 9:00am",
    title: "Registration & Get Settled",
    description: [
      "Arrive early to find your seat and get comfortable.",
      "Registration desk opens for check-in.",
    ],
    type: "networking",
    duration: 15,
  },
  {
    id: "welcome-keynote",
    time: "9:00 - 9:30am",
    title: "Welcome Keynote",
    speaker: "TBD",
    description: [
      "Kick off the day with insights from our industry leaders.",
      "Opening session featuring welcome remarks and conference overview.",
      "Speaker details to be announced soon.",
    ],
    type: "keynote",
    duration: 30,
  },
  {
    id: "first-session",
    time: "9:30 - 10:15am",
    title: "Session 1 - TBD",
    speaker: "TBD",
    description: [
      "Exciting session on emerging technologies and innovations.",
      "Topic and speaker details will be announced soon.",
      "Stay tuned for updates on this session.",
    ],
    type: "lecture",
    duration: 45,
  },
  {
    id: "second-session",
    time: "10:15 - 11:00am",
    title: "Session 2 - TBD",
    speaker: "TBD",
    description: [
      "Another engaging session featuring industry insights.",
      "Session details are being finalized and will be shared soon.",
      "Check back for the latest updates.",
    ],
    type: "lecture",
    duration: 45,
  },
  {
    id: "morning-break",
    time: "11:00 - 11:30am",
    title: "Morning Break",
    description: [
      "Coffee break and networking opportunity.",
      "Connect with fellow participants and speakers.",
      "Light refreshments provided.",
    ],
    type: "break",
    duration: 30,
  },
  {
    id: "panel-discussion",
    time: "11:30am - 12:30pm",
    title: "Panel Discussion - TBD",
    speaker: "Panel of Experts (TBD)",
    description: [
      "Interactive panel discussion with industry leaders.",
      "Panelists and topic details to be announced.",
      "Audience Q&A session included.",
    ],
    type: "lecture",
    duration: 60,
  },
  {
    id: "lunch-break",
    time: "12:30 - 2:00pm",
    title: "Lunch & Networking",
    description: [
      "Extended lunch break with networking opportunities.",
      "Enjoy a variety of local and international cuisine.",
      "Continue conversations and build connections.",
    ],
    type: "break",
    duration: 90,
  },
  {
    id: "afternoon-session-1",
    time: "2:00 - 2:45pm",
    title: "Session 3 - TBD",
    speaker: "TBD",
    description: [
      "Afternoon session featuring cutting-edge topics.",
      "Speaker and topic details coming soon.",
      "Interactive discussion and insights.",
    ],
    type: "lecture",
    duration: 45,
  },
  {
    id: "afternoon-session-2",
    time: "2:45 - 3:30pm",
    title: "Session 4 - TBD",
    speaker: "TBD",
    description: [
      "Deep dive into emerging technologies and trends.",
      "Expert insights and practical applications.",
      "Session details to be announced.",
    ],
    type: "lecture",
    duration: 45,
  },
  {
    id: "afternoon-break",
    time: "3:30 - 4:00pm",
    title: "Afternoon Break",
    description: [
      "Short break to recharge and network.",
      "Refreshments and informal discussions.",
      "Prepare for the final sessions.",
    ],
    type: "break",
    duration: 30,
  },
  {
    id: "workshop-session",
    time: "4:00 - 5:00pm",
    title: "Interactive Workshop - TBD",
    speaker: "TBD",
    description: [
      "Hands-on workshop session with practical activities.",
      "Learn by doing with expert guidance.",
      "Workshop topic and facilitator to be announced.",
    ],
    type: "workshop",
    duration: 60,
  },
  {
    id: "closing-session",
    time: "5:00 - 5:30pm",
    title: "Closing Ceremony & Final Networking",
    speaker: "TBD",
    description: [
      "Wrap up the event with key takeaways and closing remarks.",
      "Final networking opportunity with all attendees.",
      "Thank you messages and event conclusion.",
    ],
    type: "networking",
    duration: 30,
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
