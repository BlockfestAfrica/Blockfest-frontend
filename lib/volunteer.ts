/**
 * Volunteering for the current edition.
 *
 * Kept as data so the page stays readable and the departments can be checked
 * against the application form. The form's dropdown and this list must agree:
 * a department described here that a reader then cannot select is a dead end.
 */

export const VOLUNTEER_FORM_URL = "https://forms.gle/wBenVpKTA3uqHuyt9";

/** The full roles document, which the form asks applicants to read first. */
export const VOLUNTEER_ROLES_DOC_URL =
  "https://docs.google.com/document/d/1E0da3ScdqivsazN-NZANHaCk5NHsELmN5FaA0iQ_fYY/edit?usp=sharing";

/** Addresses a shortlisted volunteer may hear from. */
export const VOLUNTEER_CONTACT_EMAILS = [
  "zebulun@blockfestafrica.com",
  "partnership@blockfestafrica.com",
  "programs@blockfestafrica.com",
] as const;

export interface VolunteerDay {
  date: string;
  weekday: string;
  title: string;
  description: string;
}

/**
 * Volunteering covers the two open days. The invitation-only Mixer on the 24th
 * is not a volunteer shift.
 */
export const volunteerDays: VolunteerDay[] = [
  {
    date: "22 October",
    weekday: "Thursday",
    title: "Workshops, masterclasses and the deal room",
    description:
      "Technical and non-technical workshops and masterclasses from the morning, then a closed deal room for founders and investors later in the day.",
  },
  {
    date: "23 October",
    weekday: "Friday",
    title: "Conference and exhibition",
    description:
      "The main conference and the exhibition floor, from the morning through to late afternoon.",
  },
];

export interface VolunteerTeam {
  id: string;
  name: string;
  purpose: string;
  responsibilities: string[];
  idealFor: string;
  /** Which extra section of the form this team's applicants answer. */
  assessment: "creative" | "operations";
  /**
   * Whether the application form currently lets someone pick this team. The
   * roles document describes Registration; the form's dropdown does not offer
   * it, so the page says so rather than sending people looking for it.
   */
  selectableInForm: boolean;
}

export const volunteerTeams: VolunteerTeam[] = [
  {
    id: "logistics",
    name: "Logistics & Operations",
    purpose: "Keep the event running smoothly behind the scenes.",
    responsibilities: [
      "Oversee venue setup and breakdown with vendors",
      "Coordinate room readiness for speakers, press and sessions",
      "Monitor event schedules and operational timelines with the programmes team",
      "Test the registration flow and attendee movement plans before event week",
      "Assist the event coordinator with on-site execution",
      "Troubleshoot operational issues during the event",
      "Coordinate inventory of event materials, merchandise, lanyards, badges and supplies",
      "Support vendor logistics planning: delivery schedules, access points, loading bays",
      "Coordinate movement of equipment between stages and workshop rooms",
      "Support crowd flow and queue management",
    ],
    idealFor:
      "Organised people who stay calm under pressure, are happy on their feet and notice detail.",
    assessment: "operations",
    selectableInForm: true,
  },
  {
    id: "hospitality",
    name: "Hospitality & Guest Experience",
    purpose:
      "Create an exceptional experience for every attendee, speaker, sponsor and VIP.",
    responsibilities: [
      "Greet attendees and direct them",
      "Assist with lounge planning and guest flow design",
      "Learn speaker profiles and sponsor expectations",
      "Coordinate refreshments and catering support with vendors",
      "Escort speakers and special guests",
      "Handle guest enquiries and basic problem resolution",
      "Keep networking areas functional and uncrowded",
      "Monitor attendee comfort and experience",
      "Manage stage transitions between speakers and hosts",
      "Provide protocol support for speakers and VIPs",
    ],
    idealFor: "Friendly, confident communicators with strong people skills.",
    assessment: "operations",
    selectableInForm: true,
  },
  {
    id: "registration",
    name: "Registration",
    purpose: "Get everyone checked in quickly and accurately.",
    responsibilities: [
      "Ticket verification",
      "Badge printing and distribution",
      "QR code scanning",
      "Manage registration queues",
      "Direct attendees after check-in",
      "Handle accreditation for attendees, media, VIPs, guests, speakers, sponsors and team",
    ],
    idealFor:
      "Fast learners who communicate well, stay organised and are comfortable with a crowd.",
    assessment: "operations",
    selectableInForm: false,
  },
  {
    id: "technical",
    name: "Stage & Technical Operations",
    purpose:
      "Support the technical delivery of every session and stage across both days.",
    responsibilities: [
      "Assist AV technicians",
      "Manage microphones and stage equipment",
      "Coordinate speaker slides",
      "Session timing and countdown management",
      "Workshop room technical assistance",
      "Internet and equipment monitoring",
    ],
    idealFor:
      "Technically inclined volunteers with AV, streaming or production experience.",
    assessment: "operations",
    selectableInForm: true,
  },
  {
    id: "editorial",
    name: "Editorial & Social Media",
    purpose: "Tell the Blockf3st story in real time, before and during the event.",
    responsibilities: [
      "Live tweeting and thread writing",
      "Instagram Stories and Reels support",
      "Short-form vertical content capture",
      "Speaker quote cards and real-time event updates",
      "Community engagement online, and collecting attendee testimonials",
      "Trend-based content during the event",
      "Develop the social content calendar",
      "Write posts across X, Instagram, LinkedIn, TikTok and Threads",
      "Research trends and content opportunities",
      "Produce speaker spotlights and founder features",
      "Coordinate countdown campaigns and community engagement initiatives",
      "Draft captions, threads and social copy",
      "Plan live coverage strategy and content distribution workflows",
      "Coordinate with the video and media teams for rapid content delivery",
    ],
    idealFor:
      "Fast writers, skilled creators, community managers and social media natives.",
    assessment: "creative",
    selectableInForm: true,
  },
  {
    id: "media",
    name: "Media: Video & Photography",
    purpose:
      "Produce high-quality visual documentation and storytelling, and support media coverage.",
    responsibilities: [
      "Event photography and press room support",
      "Coordinate interviews and organise photo and press requests",
      "Collect media assets",
      "Develop video concepts and storyboards, and plan promotional shoots",
      "Film teaser campaigns, speaker announcements and countdown videos",
      "Create sponsor and partner video content",
      "Plan interview formats and build shot lists for event-day coverage",
      "Coordinate equipment, crew schedules and editing workflows",
      "Capture venue setup and behind-the-scenes production",
      "Film keynotes, workshops, exhibitions and networking",
      "Record interviews with founders, investors, speakers and attendees",
      "Capture B-roll and social-first vertical content",
      "Deliver same-day highlight videos and reels",
    ],
    idealFor: "Skilled videographers, editors and cinematographers.",
    assessment: "creative",
    selectableInForm: true,
  },
  {
    id: "design",
    name: "Design & Visual Assets",
    purpose: "Produce the graphics that support event operations and content.",
    responsibilities: [
      "Develop brand visual identity and event branding designs",
      "Emergency information graphics",
      "Print-ready materials: merch, lanyards and more",
      "Template management",
      "Create speaker cards, sponsor assets and promotional graphics",
      "Develop presentation templates",
      "Design signage, maps, badges, lanyards and printed materials",
      "Prepare exhibition and booth graphics",
      "Create motion graphics for screens and stage visuals",
    ],
    idealFor:
      "Skilled graphic, animation, motion, illustration and brand designers.",
    assessment: "creative",
    selectableInForm: true,
  },
  {
    id: "exhibition",
    name: "Exhibition & Partnership Support",
    purpose:
      "Support sponsors, exhibitors and partners from onboarding through to post-event reporting, so their activations actually work.",
    responsibilities: [
      "Support the partnerships team with sponsor and exhibitor onboarding",
      "Collect brand assets, logos, booth requirements, activation details and technical needs",
      "Track partner deliverables and outstanding requests",
      "Assist with exhibition floor planning and booth allocation",
      "Confirm booths have the furniture, branding, electricity, internet and other resources agreed",
      "Help partners find storage, loading areas, meeting rooms and green rooms",
      "Brief partner representatives on venue procedures and escalation points",
      "Be the primary volunteer contact for assigned exhibitors and partners on event day",
      "Coordinate with Hospitality when partners need refreshments or guest assistance",
    ],
    idealFor:
      "Highly organised, professional and well-spoken people who can coordinate across teams and stay ahead of detail.",
    assessment: "operations",
    selectableInForm: true,
  },
];

/** Asked of everyone, whichever team they land in. */
export const volunteerExpectations = [
  "Attend volunteer orientation and meetings",
  "Arrive on time for every assigned shift",
  "Wear the official Blockf3st volunteer badge and shirt",
  "Keep a professional and respectful attitude",
  "Communicate clearly with your team lead",
  "Follow instructions from the Event Coordinator and Volunteer Operations team",
  "Do not leave your assigned area without telling your lead",
  "Protect confidential information about speakers, sponsors and attendees",
  "Be ready for long hours, standing, walking and problem solving",
];
