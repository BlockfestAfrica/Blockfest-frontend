/**
 * The site-wide privacy policy.
 *
 * Separate from the campaign notice in lib/monica-privacy.ts, which covers one
 * campaign in detail. This covers everything else: the newsletter, tickets,
 * speaker and volunteer applications, the badge generator and analytics.
 *
 * The honest shape of this site is that most of its forms are not its own.
 * Newsletter signups go to Substack, tickets to Meetumo, and speaker and
 * volunteer applications to Google Forms. A policy that implied we hold all of
 * that would be wrong in a way that matters: it would tell somebody to write to
 * us to have data deleted that we cannot reach. So each surface names where the
 * data actually goes, and says plainly which ones we hold ourselves.
 *
 * The badge generator is worth stating for the opposite reason. It takes a
 * photograph and never uploads it: there is no fetch in that feature at all,
 * and the image is composed in the browser. People assume uploading a photo to
 * a website means the website has their photograph, and here it does not.
 */

import { CONTACT_EMAIL } from "@/lib/constants";

export const PRIVACY_VERSION = "1.0";

/** ISO date. Rendered in the event's own timezone. */
export const PRIVACY_UPDATED = "2026-09-12";

export interface PolicySection {
  /** Anchor, so a specific answer can be linked to in a request or complaint. */
  id: string;
  title: string;
  paragraphs: string[];
}

/**
 * Each place the site asks for something, and who ends up holding it.
 *
 * `heldByUs` is the field that decides what somebody can ask us to do. Where it
 * is false, we can pass a request on but the provider is the one that holds the
 * record.
 */
export interface DataSurface {
  name: string;
  collects: string;
  destination: string;
  heldByUs: boolean;
}

export const privacySurfaces: DataSurface[] = [
  {
    name: "Campaign registration",
    collects:
      "Name, email address, phone number, social handles, content niche, and optionally audience size and location. Your IP address and browser are recorded automatically.",
    destination:
      "Held by us, in our own database. Covered in full by the campaign privacy notice.",
    heldByUs: true,
  },
  {
    name: "Newsletter",
    collects: "Your email address.",
    destination:
      "Held by Substack, who run our newsletter. Subscribing is done on their platform and under their privacy policy, and every issue carries an unsubscribe link.",
    heldByUs: false,
  },
  {
    name: "Tickets",
    collects:
      "Whatever the ticket form asks for, which includes your name, email address and phone number, and may include access or dietary requirements.",
    destination:
      "Held by Meetumo, who handle our ticketing and payment. We receive an attendee list from them in order to run the event.",
    heldByUs: false,
  },
  {
    name: "Call for speakers",
    collects: "Your application, including your name, contact details and talk.",
    destination:
      "Submitted through Google Forms and held in our Google account. We read these ourselves to select speakers.",
    heldByUs: true,
  },
  {
    name: "Volunteer applications",
    collects: "Your application, including your name and contact details.",
    destination:
      "Submitted through Google Forms and held in our Google account. We read these ourselves to build the volunteer team.",
    heldByUs: true,
  },
  {
    name: "Badge generator",
    collects: "A photograph, if you choose one.",
    destination:
      "Nothing is uploaded. The badge is made in your browser and your photograph never reaches us or anybody else. Closing the tab is all it takes to remove it.",
    heldByUs: false,
  },
  {
    name: "Analytics",
    collects:
      "Pages visited, roughly where in the world the visit came from, and which buttons were used.",
    destination:
      "Collected through Sabilytics. Used to understand which pages work, not to identify you.",
    heldByUs: false,
  },
];

export const privacySections: PolicySection[] = [
  {
    id: "who",
    title: "Who we are",
    paragraphs: [
      "Blockfest Africa is operated by Tevah Synergy, which is the data controller for this website and for the events it runs. That means Tevah Synergy decides what is collected and is the entity answerable for it.",
      `Anything about your personal data goes to ${CONTACT_EMAIL}.`,
    ],
  },
  {
    id: "not-ours",
    title: "Forms that are not ours",
    paragraphs: [
      "Several things this site asks for are handled by somebody else. Newsletter signups go to Substack, tickets to Meetumo, and speaker and volunteer applications to Google Forms. When you use one of those, you are giving your details to that provider as well as to us, under their own privacy terms.",
      "This matters for what you can ask for. We can act on a request about anything we hold ourselves, and the table above says which of these that is. Where a provider holds the record, we will pass your request on and tell you we have, but they are the ones who can act on it.",
      "We do not sell personal data, and we do not share it with anyone for their own marketing.",
    ],
  },
  {
    id: "why",
    title: "Why we are allowed to hold it",
    paragraphs: [
      "Where you have asked us for something, such as a ticket or a place in a campaign, the basis is the agreement between us: we cannot run an event or judge a competition without knowing who is taking part.",
      "Where you have chosen to hear from us, such as the newsletter or an optional campaign opt-in, the basis is your consent, and you can withdraw it at any time without giving a reason.",
      "Where we keep the site working and safe, such as recording an IP address against a form submission to stop automated abuse, the basis is our legitimate interest in the site not being attacked. We do not use that information to build a profile of you.",
    ],
  },
  {
    id: "keeping",
    title: "How long we keep it",
    paragraphs: [
      "Event and campaign records are kept for 24 months after the event or campaign they belong to, which covers a late dispute and the accounting record of any payment. After that they are deleted or anonymised.",
      "Applications from people we did not select are kept for 12 months, so we can approach you about the next event, and then deleted.",
      "Newsletter subscriptions last until you unsubscribe. Analytics are aggregated and are not tied to a person.",
    ],
  },
  {
    id: "rights",
    title: "What you can ask for",
    paragraphs: [
      "Under the Nigeria Data Protection Act you can ask us for a copy of what we hold about you, ask us to correct it, ask us to delete it, object to a particular use, or withdraw a consent you gave.",
      `Write to ${CONTACT_EMAIL} and we will respond within 30 days. You do not need to explain why, and asking costs nothing.`,
      "If you are not satisfied with how we handled your request, you can complain to the Nigeria Data Protection Commission.",
    ],
  },
  {
    id: "security",
    title: "How it is protected",
    paragraphs: [
      "Data we hold ourselves sits in an access-controlled database reached only over encrypted connections, and only people working on the event or campaign can see it.",
      "We ask for as little as we can, and we do not ask for payment details on this site at all. Where a payment is taken it is taken by our ticketing provider, and card details never reach us.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "This site is not intended for children, and our campaigns are open only to people aged 18 or over. We do not knowingly collect personal data from a child. If you believe we have, write to us and we will delete it.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    paragraphs: [
      `This is version ${PRIVACY_VERSION}. If we change it materially we will update the date at the top, and where the change affects something you have already given us, we will say so directly rather than relying on you to notice.`,
    ],
  },
];
