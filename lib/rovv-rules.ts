/**
 * Rules for "If ROVV Takes Me to Blockfest…", Rovv's TikTok campaign.
 *
 * From Rovv's brief (12 October 2026) and the owner's answers the same day:
 * one entry per person, 18 or over and able to attend in Lagos, winners
 * emailed by 20 October with their TikTok usernames on the page, and every
 * entry shared with Rovv so it can confirm the referral codes.
 *
 * Published before anyone enters for the reason Monica's are: a term nobody
 * was shown before entering is not a term. The version is stored on every
 * entry, so it is always answerable which text a given entrant accepted.
 *
 * The brief leaves a few things open. Where a sensible default exists it is
 * written in and was listed to the owner for approval; where none does, it
 * is in rovvRulesOpenPoints and shows on the page as still being settled.
 */
import type { RuleSection } from "@/lib/monica-rules";
import { PRIVACY_CONTACT } from "@/lib/monica-privacy";

/* 1.1, the same day and before any entry: the prize is a BUIDL PASS for
   Day 2, claimed with a 100%-off code and no deadline; winners by 4 PM on
   Monday 19 October; a ruled-out entry can be fixed and sent again. */
export const ROVV_RULES_VERSION = "1.1";

/** ISO date. Rendered in the event's own timezone. */
export const ROVV_RULES_UPDATED = "2026-10-12";

export const rovvRules: RuleSection[] = [
  {
    id: "entering",
    title: "Who can enter",
    paragraphs: [
      "This campaign is organised by Blockfest Africa with ROVV. Blockfest Africa is operated by Tevah Synergy, which is responsible for the campaign and for giving out the prizes.",
      "Entry is free and open to anyone aged 18 or over who can attend Blockfest Africa 2026 in Lagos on Friday 23 October 2026, the day the prize is for. The prize is a pass only: getting to Lagos and staying there is up to you.",
      "Employees of Blockfest Africa and of ROVV cannot enter.",
    ],
  },
  {
    id: "how",
    title: "How to enter",
    paragraphs: [
      "Make an original TikTok video on the prompt \"If ROVV Takes Me to Blockfest…\". The format is up to you.",
      "Post it publicly on your own TikTok account, tag @rovvafrica and @blockfestafrica, and use #ROVVMeToBlockfest.",
      "Download the ROVV app and register.",
      "Then enter on the campaign page with your full name, email address, TikTok username, the link to your video and your ROVV referral code.",
    ],
  },
  {
    id: "dates",
    title: "Dates",
    paragraphs: [
      "Entries open at 12:00 AM on Tuesday 13 October 2026 and close at 11:59 PM on Sunday 18 October 2026, Lagos time. Entries received outside that window are not accepted.",
      "The team judges the entries the day after they close. Winners are announced by 4:00 PM on Monday 19 October 2026: each is emailed, and their TikTok username is listed on the campaign page.",
    ],
  },
  {
    id: "one-entry",
    title: "One entry each",
    paragraphs: [
      "Each person may enter once, with one video. Your email address is your entry.",
      "If you made a mistake, enter again before the close with the same email address and the same TikTok username. Your new details replace the old ones, as long as the team has not already accepted your entry.",
      "If the team rules your entry out, we email you the reason. You can fix it and enter again the same way before the close, and it goes back to the team.",
      "Only one entry per video can be accepted, and it must be from the person who posted it. If the same video is entered more than once, the team decides whose it is. Once a video has been accepted for one person, nobody else can enter it.",
    ],
  },
  {
    id: "rovv-registration",
    title: "Your ROVV registration",
    paragraphs: [
      "Registering on the ROVV app is a condition of entry. ROVV confirms the referral code you give belongs to an account registered on its app, and an entry whose registration cannot be confirmed is not eligible to win.",
      "Your ROVV account itself is between you and ROVV, under ROVV's own terms and privacy policy.",
    ],
  },
  {
    id: "content",
    title: "What your video may and may not show",
    paragraphs: [
      "Your video must be your own original work. A re-upload or an edit of somebody else's video is not eligible.",
      "Do not film while driving or riding, and do not do anything unsafe on or around the road to make your video.",
      "Do not make claims about ROVV, such as prices, safety or where it operates, that ROVV does not make itself.",
      "Your video must follow TikTok's own rules, including on music. Videos that are offensive, discriminatory or misleading are not eligible.",
    ],
  },
  {
    id: "keeping-it-up",
    title: "Keeping your video up",
    paragraphs: [
      "Keep your video public, with its tags and hashtag, until Saturday 24 October 2026. A winning video that is deleted or made private before then may lose its prize.",
    ],
  },
  {
    id: "judging",
    title: "How winners are chosen",
    paragraphs: [
      "The team reviews every entry by hand and chooses 20 winners for creativity and relevance to the prompt. Views, likes and follower counts do not decide it.",
      "An entry that does not follow these rules is marked ineligible, with a reason, and cannot win.",
      "Each person can win once.",
    ],
  },
  {
    id: "prize",
    title: "The prize",
    paragraphs: [
      "Each of the 20 winners receives one BUIDL PASS to Blockfest Africa 2026, for Day 2, Conference Day, on Friday 23 October 2026, with access to the main stage and the exhibition area.",
      "Each winner is emailed their own code. They register for the BUIDL PASS on our ticket page in their own name, and the code takes the full price off. There is no deadline to register before the event.",
      "The code is for the winner's own use and cannot be exchanged for cash. Travel and accommodation are not included.",
      "Winners' TikTok usernames are published on the campaign page once they have been told.",
    ],
  },
  {
    id: "your-content",
    title: "Your video",
    paragraphs: [
      "You own what you make. Entering does not transfer ownership.",
      "By entering you allow Blockfest Africa and ROVV to reshare and feature your video, as you published it and with credit to you, in campaign and event material for two years from the end of the campaign. Neither of us may edit it into something you did not say.",
    ],
  },
  {
    id: "your-details",
    title: "Your details",
    paragraphs: [
      "Entering means giving us your name, email address, TikTok username, the link to your video and your ROVV referral code. We share your name, email address, TikTok username and referral code with ROVV so it can confirm your registration.",
      "What we collect, who sees it, how long it is kept and what you can ask for are set out in the campaign privacy notice, linked from the entry form.",
    ],
  },
  {
    id: "decisions",
    title: "Decisions and changes",
    paragraphs: [
      "Our decisions on eligibility and winners are final.",
      "These rules may be amended during the campaign. The version you accepted is recorded with your entry, and material changes are announced on the campaign page.",
      `Questions or complaints about the campaign go to ${PRIVACY_CONTACT}.`,
    ],
  },
];

/**
 * What the campaign team still has to settle, shown on the rules page rather
 * than guessed at. Remove each line once the clause above says it.
 */
export const rovvRulesOpenPoints: string[] = [];
