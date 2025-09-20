type AgendaItem = {
  time: string;
  title: string;
  description: string[];
  speaker?: string;
};

export const agendaItems: AgendaItem[] = [
  {
    time: "8:45 - 9:00am",
    title: "Get Settled",
    description: ["Arrive early to find your seat and get comfortable."],
  },
  {
    time: "9:00 - 9:30am",
    title: "Welcome Keynote",
    speaker: "John Doe",
    description: [
      "Kick off the day with insights from our industry leaders.",
      "They will share upcoming trends and innovations shaping the future.",
    ],
  },
  {
    time: "9:30 - 10:15am",
    title: "First Lecture Topic",
    speaker: "Jane Smith",
    description: [
      "Dive deep into the latest advancements in AI, Blockchain and automation."
    ],
  },
  {
    time: "10:15 - 11:00am",
    title: "Second Lecture Topic",
    speaker: "John Doe",
    description: [
      "Learn how second lecture topic these innovations are being applied in real-world solutions.",
    ],
  },
  {
    time: "11:00 - 12:00pm",
    title: "Break",
    speaker: "Panel of Experts",
    description: [
      "An opportunity to connect with fellow participants and industry experts.",
      "Enjoy light refreshments while building valuable relationships.",
    ],
  },
];
