/**
 * The public run of show for Lagos '26, from the team's own sheet
 * ("Blockfest Lagos 2026 Run-Of-Show", 16 October).
 *
 * Only what an attendee or a speaker needs: when, what, who and where. The
 * sheet's working notes (crowd numbers, accreditation lanes, host cues,
 * shuttle cues) are the team's and are left out on purpose. Names are as the
 * sheet has them. A new session is one more line here, in time order.
 */

export type SessionKind =
  | "welcome"
  | "address"
  | "keynote"
  | "panel"
  | "fireside"
  | "talk"
  | "workshop"
  | "masterclass"
  | "break"
  | "networking"
  | "sponsor"
  | "entertainment"
  | "host"
  | "closing"
  | "logistics";

/** A line of names under a session: "Moderator", "Panelists", "Speaker"... */
export interface RunPeople {
  label: string;
  names: string;
}

export interface RunSession {
  start: string;
  end: string;
  kind: SessionKind;
  /** What the kind is called on the page when it is not just the kind. */
  label?: string;
  title: string;
  /** One line under the title, for what a session is when its title is not enough. */
  detail?: string;
  /** Where in the venue, when the sheet says. */
  place?: string;
  people?: RunPeople[];
}

/** One room's session, in a slot where the rooms run side by side. */
export interface RunTrack {
  room: string;
  title: string;
  people: RunPeople[];
}

/** A slot where two rooms run at once. */
export interface RunSplit {
  start: string;
  end: string;
  kind: SessionKind;
  label: string;
  tracks: RunTrack[];
}

export type RunBlock = RunSession | RunSplit;

export const isSplit = (block: RunBlock): block is RunSplit => "tracks" in block;

export interface RunDay {
  id: string;
  /** "Day 1". */
  name: string;
  /** ISO date, for the heading and the machine-readable time. */
  date: string;
  /** What the day is: "Workshops & masterclasses". */
  theme: string;
  venue: string;
  blocks: RunBlock[];
}

const TECHNICAL = "Technical Room (Room 2)";
const NON_TECHNICAL = "Non-Technical Room (Room 1)";

export const runOfShow2026: RunDay[] = [
  {
    id: "day-1",
    name: "Day 1",
    date: "2026-10-22",
    theme: "Workshops & masterclasses",
    venue: "Ibis Hotel, Lekki",
    blocks: [
      {
        start: "10:00",
        end: "10:05",
        kind: "welcome",
        title: "Welcome",
        detail: "Setting the scene",
        people: [{ label: "Host", names: "Xploit" }],
      },
      {
        start: "10:05",
        end: "10:10",
        kind: "address",
        title: "Welcome to BlockFest Africa 2026",
        people: [{ label: "Speaker", names: "Convener, Blockfest Africa" }],
      },
      {
        start: "10:10",
        end: "10:30",
        kind: "fireside",
        title: "Building the Infrastructure for Africa's Digital Future",
        people: [
          {
            label: "Speaker",
            names: "Hon. Olatunbosun Alake, Commissioner for Innovation, Science & Technology",
          },
        ],
      },
      {
        start: "10:30",
        end: "10:40",
        kind: "logistics",
        label: "Room split",
        title: "Choose your room",
        detail: `Head to the ${TECHNICAL} or the ${NON_TECHNICAL}. Both rooms run at the same time from here.`,
        people: [{ label: "Host", names: "Xploit" }],
      },
      {
        start: "10:40",
        end: "11:45",
        kind: "workshop",
        label: "Workshop 1",
        tracks: [
          {
            room: TECHNICAL,
            title: "Prompt to Payments: Stablecoin Edition",
            people: [{ label: "Facilitator", names: "Tobiloba Adedeji" }],
          },
          {
            room: NON_TECHNICAL,
            title: "The Brand Lab",
            people: [{ label: "Facilitator", names: "Bibi Eneje" }],
          },
        ],
      },
      {
        start: "11:50",
        end: "12:35",
        kind: "masterclass",
        label: "Masterclass 1",
        tracks: [
          {
            room: TECHNICAL,
            title: "From Hackathon to Startup: Turning Your Project into a Real Product",
            people: [{ label: "Facilitator", names: "Ayomide Shodipo" }],
          },
          {
            room: NON_TECHNICAL,
            title: "Community Is the Moat: Building Audiences Beyond Hype",
            people: [{ label: "Facilitator", names: "Yewande Abiodun" }],
          },
        ],
      },
      {
        start: "12:40",
        end: "13:15",
        kind: "networking",
        title: "Networking break",
      },
      {
        start: "13:20",
        end: "14:25",
        kind: "workshop",
        label: "Workshop 2",
        tracks: [
          {
            room: TECHNICAL,
            title: "Build Your First AI Agent: From Prompt to Autonomous Action",
            people: [{ label: "Facilitator", names: "Idris Olubisi" }],
          },
          {
            room: NON_TECHNICAL,
            title: "Taste Is the New Skill: Creative Direction in the Age of AI",
            people: [{ label: "Facilitators", names: "Daniel Emeka & Aiseosa Uyi-Idahor" }],
          },
        ],
      },
      {
        start: "14:30",
        end: "15:15",
        kind: "masterclass",
        label: "Masterclass 2",
        tracks: [
          {
            room: TECHNICAL,
            title:
              "Reimagining How We Build, Work, and Create Value Across AI, Web3, and the Next Era of Digital Innovation",
            people: [{ label: "Facilitator", names: "Onone Peace Ega" }],
          },
          {
            room: NON_TECHNICAL,
            title: "Launching Your Developer Community: From Chapter Zero to 100 Active Members",
            people: [{ label: "Facilitator", names: "Sodiq Akinjobi" }],
          },
        ],
      },
      {
        start: "15:20",
        end: "15:30",
        kind: "closing",
        title: "Closing address",
        detail: "Announcements and closing words from the programmes team",
      },
    ],
  },
  {
    id: "day-2",
    name: "Day 2",
    date: "2026-10-23",
    theme: "The main conference",
    venue: "National Art Theatre",
    blocks: [
      {
        start: "07:00",
        end: "08:00",
        kind: "logistics",
        label: "Doors open",
        title: "Registration & accreditation",
        place: "Entry / Foyer",
      },
      {
        start: "08:00",
        end: "09:00",
        kind: "networking",
        title: "Pre-event networking & sponsor activations",
        detail: "The foyer and exhibition area are open and the sponsor booths are active",
        place: "Entry / Foyer",
      },
      {
        start: "09:00",
        end: "09:30",
        kind: "welcome",
        title: "Hosts intro: Setting the scene",
        place: "Main Hall",
        people: [{ label: "Host", names: "Hosts" }],
      },
      {
        start: "09:30",
        end: "09:40",
        kind: "address",
        title: "Welcome to Blockfest Africa 2026",
        detail: "What we are doing today",
        place: "Main Hall",
        people: [{ label: "Speaker", names: "Sarah Idahosa, Programs Director, Blockfest Africa" }],
      },
      {
        start: "09:40",
        end: "10:00",
        kind: "keynote",
        title: "Building Africa's Future Through Technology and Education",
        place: "Main Hall",
        people: [
          { label: "Speaker", names: "Dr. Maruf Olatunji Alausa, CON, Minister of Education" },
        ],
      },
      {
        start: "10:00",
        end: "10:45",
        kind: "panel",
        label: "Panel 1",
        title: "Founders & Capital: Building Africa's Next Giants",
        place: "Main Hall",
        people: [
          { label: "Moderator", names: "Coach Yemi" },
          {
            label: "Panelists",
            names: "Uchenna Edeoga, Bolutife Kusimo, Ada Nduka Oyom, Chibuotu Amadi",
          },
        ],
      },
      {
        start: "10:45",
        end: "10:55",
        kind: "talk",
        label: "Lightning talk 1",
        title: "Creators + Monetisation: Who Owns African Culture Now?",
        place: "Main Hall",
        people: [{ label: "Speaker", names: "Salem King, Co-founder, Crea8torium" }],
      },
      {
        start: "10:55",
        end: "11:00",
        kind: "sponsor",
        label: "Sponsor spotlight",
        title: "Monica video display on screen",
        place: "Main Hall",
      },
      {
        start: "11:00",
        end: "11:05",
        kind: "host",
        title: "Energy reset by hosts",
        place: "Main Hall",
      },
      {
        start: "11:05",
        end: "11:50",
        kind: "panel",
        label: "Panel 2",
        title: "Payments Without Borders: Building Africa's New Financial Rails",
        place: "Main Hall",
        people: [
          { label: "Moderator", names: "Achusi Amara" },
          {
            label: "Panelists",
            names: "Akitoye Balogun, Ashley Olika, Eniola Osiyoku, Timilehin Kayode",
          },
        ],
      },
      {
        start: "11:50",
        end: "12:00",
        kind: "talk",
        label: "Lightning talk 2",
        title: "Tokenizing Africa: Who owns the next economy?",
        place: "Main Hall",
        people: [
          { label: "Speaker", names: "Samuel Olaoyenikan Oladokun, Convener, Blockfest Africa" },
        ],
      },
      {
        start: "12:00",
        end: "12:05",
        kind: "host",
        title: "Internet takeover",
        place: "Main Hall",
      },
      {
        start: "12:10",
        end: "12:25",
        kind: "keynote",
        label: "Headline keynote",
        title:
          "The Off-Ramp Is the On-Ramp: Why Cashing Out Is the Most Important Product in African Crypto",
        place: "Main Hall",
        people: [{ label: "Speaker", names: "Adewale Akinpelu, Marketing Executive, Monica" }],
      },
      {
        start: "12:25",
        end: "12:30",
        kind: "entertainment",
        label: "Entertainment",
        title: "Spoken words",
        place: "Main Hall",
        people: [{ label: "Speaker", names: "Xploit" }],
      },
      {
        start: "12:30",
        end: "12:35",
        kind: "sponsor",
        label: "Sponsor spotlight",
        title: "MTN",
        place: "Main Hall",
      },
      {
        start: "12:35",
        end: "13:45",
        kind: "break",
        label: "Lunch",
        title: "Lunch break and networking",
        place: "Foyer + Outdoor",
      },
      {
        start: "13:45",
        end: "13:55",
        kind: "host",
        title: "Hosts re-energise the room",
        detail: "Post-lunch warm-up and an audience participation moment",
        place: "Main Hall",
      },
      {
        start: "13:55",
        end: "14:15",
        kind: "keynote",
        label: "Keynote",
        title: "Policy Meets Protocol: Can Government Keep Pace with Africa's Builders?",
        place: "Main Hall",
        people: [
          { label: "Speaker", names: "Dr. Kadri Obafemi Hamzat, Deputy Governor, Lagos State" },
        ],
      },
      {
        start: "14:15",
        end: "15:00",
        kind: "panel",
        label: "Panel 3",
        title: "When AI Meets Blockchain: Building Trust in an Intelligent Internet",
        place: "Main Hall",
        people: [
          { label: "Moderator", names: "Crypto Oracle" },
          {
            label: "Panelists",
            names: "Ola Elixir, Scott Eneje, Dara Sobaloju, Faith Jerry",
          },
        ],
      },
      {
        start: "15:00",
        end: "15:25",
        kind: "sponsor",
        label: "Gadget giveaway 1",
        title: "Revva video and raffle draw",
        place: "Main Hall",
        people: [{ label: "Presented by", names: "Revva and the convener" }],
      },
      {
        start: "15:25",
        end: "15:35",
        kind: "talk",
        label: "Lightning talk 3",
        title: "The Creative Economy Is a Tech Problem",
        place: "Main Hall",
        people: [{ label: "Speaker", names: "Christine Imoukhuede, Founder & CEO, Ahavaplan" }],
      },
      {
        start: "15:35",
        end: "16:20",
        kind: "panel",
        label: "Panel 4",
        title: "Careers & Entry Paths: How to Get In, Stay In, and Build a Name",
        place: "Main Hall",
        people: [
          { label: "Moderator", names: "Nifemi Dave" },
          {
            label: "Panelists",
            names: "Opeyemi Bangkok, Ian Issa, Nebeokike Sunday, Teddi",
          },
        ],
      },
      {
        start: "16:20",
        end: "16:40",
        kind: "sponsor",
        label: "Gadget giveaway 2",
        title: "Mascot gadget giveaway",
        place: "Main Hall",
        people: [{ label: "Presented by", names: "Mascot and the convener" }],
      },
      {
        start: "16:40",
        end: "16:50",
        kind: "closing",
        title: "Closing address & farewell",
        place: "Main Hall",
      },
      {
        start: "16:50",
        end: "17:00",
        kind: "logistics",
        label: "Managed exit",
        title: "Photography and final networking",
        place: "Main Hall",
      },
    ],
  },
];

/** "10:40" and "11:45" as "1 hr 5 min". */
export function sessionLength(start: string, end: string): string {
  const minutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const total = minutes(end) - minutes(start);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}
