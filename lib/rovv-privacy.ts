/**
 * The privacy notice for "If ROVV Takes Me to Blockfest…".
 *
 * The one big difference from Monica's notice: the sponsor receives personal
 * details. Rovv confirms each entrant registered on its app from the referral
 * code, and the owner chose (12 October 2026) to send it every entry to do
 * that. The form says so beside the box people tick, and this says exactly
 * which fields go and why.
 *
 * Same lawful bases as Monica's, kept apart for the same reasons: entering is
 * the agreement, hearing about future campaigns is a separate, unticked
 * consent, and the IP address and user agent are a legitimate interest in
 * keeping bots out.
 */
import type { CollectedItem, PrivacySection } from "@/lib/monica-privacy";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";

export const ROVV_PRIVACY_VERSION = "1.0";

/** ISO date. Rendered in the event's own timezone. */
export const ROVV_PRIVACY_UPDATED = "2026-10-12";

export const rovvPrivacyCollected: CollectedItem[] = [
  {
    what: "How the page is used",
    why: "A privacy-friendly measurement script counts page views and whether the form was sent, so we know the campaign reached people. It never receives anything you type into the form. It stores a random identifier in your browser to tell a returning visit from a new one, and no advertising network receives it.",
    automatic: true,
  },
  {
    what: "Your full name",
    why: "To identify your entry and, if you win, to issue your ticket in your name.",
  },
  {
    what: "Your email address",
    why: "To confirm your entry, tell you if you win, and send a winner's ticket. It is also how you replace your entry if you made a mistake.",
  },
  {
    what: "Your TikTok username",
    why: "To confirm the video was posted from your own account. Winners' usernames are published on the campaign page.",
  },
  {
    what: "The link to your TikTok video",
    why: "So the team can watch and judge it. The video stays on TikTok; we do not copy or store it.",
  },
  {
    what: "Your ROVV referral code",
    why: "So ROVV can confirm you registered on the ROVV app, which is a condition of entry.",
  },
  {
    what: "Whether you want to hear about future Blockfest Africa campaigns",
    why: "Optional, and unticked unless you tick it. Leaving it unticked has no effect on your entry.",
  },
  {
    what: "Your IP address",
    why: "Recorded automatically when you enter, to stop automated entries and abuse of the form.",
    automatic: true,
  },
  {
    what: "Your browser's user agent",
    why: "Recorded automatically for the same reason, and to diagnose an entry that failed.",
    automatic: true,
  },
  {
    what: "Which version of the rules and of this notice you accepted, and when",
    why: "Recorded so it is always answerable which wording you agreed to.",
    automatic: true,
  },
];

export const rovvPrivacySections: PrivacySection[] = [
  {
    id: "who",
    title: "Who holds this",
    paragraphs: [
      "Blockfest Africa, operated by Tevah Synergy, is the data controller for this campaign: Tevah Synergy decides what is collected and what happens to it, and answers for it.",
      `Anything about your personal data goes to ${PRIVACY_CONTACT}, including the requests set out below.`,
    ],
  },
  {
    id: "basis",
    title: "Why we are allowed to hold it",
    paragraphs: [
      "For running the campaign, the basis is the agreement between us. You enter, and we cannot judge an entry, confirm your ROVV registration or give you a ticket without knowing who you are and how to reach you. If you do not want to give these details, you cannot enter.",
      "For hearing about future Blockfest Africa campaigns and events, the basis is your consent, given separately on the form. It is optional and unticked by default, and refusing it changes nothing about your entry.",
      "For the IP address and user agent, the basis is our legitimate interest in keeping the form from being abused by automated entries. They are not used to profile you or for marketing.",
    ],
  },
  {
    id: "sharing",
    title: "Who else sees it",
    paragraphs: [
      "ROVV, which runs this campaign with us, receives your name, email address, TikTok username and ROVV referral code, so it can confirm you registered on the ROVV app. ROVV uses them for this campaign only, not for its own marketing. Your ROVV account itself is held by ROVV under its own privacy policy, and a request about that account goes to ROVV.",
      "If you win, your name and email address go to Meetumo, our ticketing provider, to issue your ticket.",
      "Your details are not sold, and are not shared with anyone else for their own marketing.",
      "They are held on services we use to run the site, including our hosting and database provider and the service that sends our email. Those providers process the data on our instructions and for no purpose of their own.",
      "We may disclose information where the law requires it, or where it is needed to establish or defend a legal claim, such as a dispute over a prize.",
    ],
  },
  {
    id: "public",
    title: "What becomes public",
    paragraphs: [
      "Your video is already public on TikTok, because the campaign runs on your own account. Entering does not make anything public that was not already.",
      "If you win, your TikTok username is published on the campaign page. We do not publish your name, email address or referral code.",
    ],
  },
  {
    id: "keeping",
    title: "How long it is kept",
    paragraphs: [
      "Entries are kept for 24 months after the campaign ends on 18 October 2026, to cover a late dispute and the record of the tickets given out. After that they are deleted or anonymised.",
      "If you opted in to hearing about future campaigns, your name and email address are kept for that until you tell us to stop. Every such message includes a way to stop it, and one line to the address above is enough.",
      "IP addresses and user agents are kept for 12 months and then deleted.",
    ],
  },
  {
    id: "rights",
    title: "What you can ask for",
    paragraphs: [
      "Under the Nigeria Data Protection Act you can ask us for a copy of what we hold about you, ask us to correct anything wrong, ask us to delete it, object to a particular use, or withdraw a consent you gave.",
      "Withdrawing marketing consent is immediate. Asking for deletion before winners are chosen means withdrawing your entry, and we will say so before acting.",
      `Write to ${PRIVACY_CONTACT} and we will respond within 30 days. If you are not satisfied with how we handled it, you can complain to the Nigeria Data Protection Commission.`,
    ],
  },
  {
    id: "security",
    title: "How it is protected",
    paragraphs: [
      "Entries are held in an access-controlled database, reached only over encrypted connections, and only people working on the campaign can see them.",
      "We ask for as little as we can: no phone number, no date of birth and no address.",
    ],
  },
];
