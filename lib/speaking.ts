import { blockfest2026Lagos } from "./events";

/**
 * The call for speakers.
 *
 * `SPEAKER_FORM_URL` is the only switch: set it and the page stops saying
 * "opening soon" and starts linking, everywhere at once. Everything else in
 * this file mirrors what the live form actually asks, so the page can be read
 * as preparation for it rather than a summary written from memory.
 */
export const SPEAKER_FORM_URL: string | null =
  "https://forms.gle/i6JJJXToKLHVixHFA";

export const isSpeakerFormOpen = SPEAKER_FORM_URL !== null;

const EVENT = blockfest2026Lagos;

export interface SessionFormat {
  name: string;
  length: string;
  description: string;
}

/**
 * The formats the application asks you to pick between.
 *
 * Each is bound to a day on the form itself — the hands-on formats run on day
 * one, the stage formats on day two — so the day is carried in the label
 * rather than left for the applicant to work out.
 */
export const sessionFormats: SessionFormat[] = [
  {
    name: "Workshop",
    length: "Day 1 · 60 min",
    description:
      "Hands-on, participatory, activity-driven. People leave having built or practised something rather than having watched you do it. Bring the repo, the dataset, the contract or the worksheet.",
  },
  {
    name: "Masterclass",
    length: "Day 1 · 20 min + 10 min Q&A",
    description:
      "An expert-led deep dive with structured questions at the end. Best for a method you have refined and can genuinely teach in one sitting.",
  },
  {
    name: "Panel discussion",
    length: "Day 2 · 45–60 min",
    description:
      "Several voices on a question that genuinely divides them, with a moderator. Bring the disagreement, not the consensus.",
  },
  {
    name: "Lightning talk",
    length: "Day 2 · 7–10 min",
    description:
      "One speaker, one idea, sharply made, no room to warm up. Often the most memorable thing on a programme.",
  },
];

/**
 * What the form asks for, in the order it asks.
 *
 * Google Forms keeps a draft, so this is not a one-sitting sprint — but the
 * writing is the slow part and it is easier done before you open the form.
 */
export const applicationChecklist = [
  {
    title: "Who you are, and where to find you",
    detail:
      "Full name, email, phone number with country code, company, job title, and the city and country you live in. Plus your LinkedIn or personal site and your X handle.",
  },
  {
    title: "The day and the format",
    detail:
      "Which day you are applying for — day one, day two, or open to either — and which of the four formats fits. The formats are tied to days, so these two answers move together.",
  },
  {
    title: "A session title and description",
    detail:
      "100 to 300 words on what attendees will actually learn or do. Specific beats broad: a session about one thing you have done lands better than a survey of a field.",
  },
  {
    title: "Two or three key takeaways",
    detail:
      "What people leave with. This is the question that separates a talk with a point from a talk with a topic, so it is worth drafting before the description.",
  },
  {
    title: "Who it is for",
    detail:
      "Which audiences the session serves — developers, creatives, founders, policy and legal, investors, marketers, newcomers — and whether it assumes no prior Web3 knowledge, some, or a room of practitioners.",
  },
  {
    title: "Your bio and your case",
    detail:
      "A bio of up to 200 words in the third person, a short answer on why you are the right person to deliver this session, and one to three events you have spoken at with the topic, year and links.",
  },
  {
    title: "Logistics",
    detail:
      "What you need in the room — projector, microphone, high-capacity WiFi for a workshop, a live coding or demo environment — whether you are Lagos-based, travelling in or joining virtually, and whether you can cover your own travel and accommodation.",
  },
  {
    title: "Why Blockfest, and one last yes or no",
    detail:
      "A short paragraph on why you want to speak at Blockfest Africa in particular — a different question from why you are the right person for the session — and whether you are willing to do a short video interview after the event.",
  },
];

/** Stated plainly, because all four are consent questions at the end of the form. */
export const speakerTerms = [
  "Applying does not guarantee a speaking slot.",
  "If selected, your name, bio and session title may be used on the site, in promotional material and on social media.",
  "Sessions may be recorded and photographed, and published or shared online afterwards.",
  "The team will contact you by email or phone about your application, and about logistics if you are selected.",
];

/** Sessions run on the first two days; the third is the invite-only Mixer. */
export const speakingDays = `Two days of sessions on 22 and 23 October at the ${EVENT.location.venue}`;

/**
 * Shape of each day, as the form describes it when you pick one.
 *
 * Day two is described by the formats you can actually apply for. The form's
 * own blurb also mentions fireside chats, but its format question does not
 * offer them, and this text sits directly above those four cards.
 */
export const speakingDayShape = [
  {
    label: "Day 1",
    time: "9am – 2pm",
    detail:
      "Workshops and masterclasses. Hands-on, skills-first sessions for founders, builders, creators and marketers.",
  },
  {
    label: "Day 2",
    time: "9am – 5pm",
    detail:
      "The main conference. Panels and lightning talks in front of the full audience.",
  },
];
