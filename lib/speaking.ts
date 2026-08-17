import { blockfest2026Lagos } from "./events";

/**
 * The call for speakers.
 *
 * The form is not open yet. `SPEAKER_FORM_URL` is the only switch: set it and
 * the page stops saying "opening soon" and starts linking, everywhere at once.
 * Nothing else needs editing.
 */
export const SPEAKER_FORM_URL: string | null = null;

export const isSpeakerFormOpen = SPEAKER_FORM_URL !== null;

const EVENT = blockfest2026Lagos;

export interface SessionFormat {
  name: string;
  length: string;
  description: string;
}

/** The formats the application asks you to pick between. */
export const sessionFormats: SessionFormat[] = [
  {
    name: "Keynote",
    length: "Main stage",
    description:
      "One person, one argument, the room's full attention. For a thesis you have earned the right to make.",
  },
  {
    name: "Panel discussion",
    length: "Moderated",
    description:
      "Three or four voices on a question that genuinely divides them. Bring the disagreement, not the consensus.",
  },
  {
    name: "Fireside chat",
    length: "Conversational",
    description:
      "A longer, less formal conversation. Best when the story behind the work is the interesting part.",
  },
  {
    name: "Lightning talk",
    length: "Under 7 minutes",
    description:
      "One idea, sharply made, no room to warm up. Often the most memorable thing on a programme.",
  },
  {
    name: "Technical workshop",
    length: "Day 1, hands on",
    description:
      "People leave having built something. Bring the repo, the dataset or the contract, and expect a room that wants to follow along rather than watch.",
  },
  {
    name: "Non-technical workshop",
    length: "Day 1, hands on",
    description:
      "The same shape without the terminal. Fundraising, go to market, design, policy, storytelling: anything people can practise in the room and use on Monday.",
  },
];

/** Prepared in advance, because the form asks for all of it in one sitting. */
export const applicationChecklist = [
  {
    title: "A session title and description",
    detail:
      "100 to 200 words on what you will actually say. Specific beats broad: a talk about one thing you have done lands better than a survey of a field.",
  },
  {
    title: "Your bio",
    detail: "100 to 150 words, written in the third person.",
  },
  {
    title: "A recent professional headshot",
    detail:
      "Used on the site and in promotion if you are selected, so send the one you would be happy to see on a banner.",
  },
  {
    title: "Your links",
    detail:
      "LinkedIn or a personal site, and your X handle. Plus one to three events you have spoken at, with the topic and year, if you have them.",
  },
  {
    title: "Who it is for",
    detail:
      "Which audiences the session serves, and which track it belongs to. Both are on the form.",
  },
];

/** Stated plainly, because all four are consent questions on the form. */
export const speakerTerms = [
  "Applying does not guarantee a speaking slot.",
  `If selected, your name, bio, session title and headshot may be used on the site, in promotional material and on social media.`,
  "Sessions are recorded and photographed, and may be published or shared online afterwards.",
  "The team will contact you by email or phone about your application, and about logistics if you are selected.",
  "The form asks whether you can cover your own travel and accommodation if you are coming from outside Lagos.",
];

/** Both days carry sessions, so a proposal can be for either. */
export const speakingDays = `${EVENT.date.displayDate.replace(/,\s*\d{4}$/, "")}, ${EVENT.location.venue}`;
