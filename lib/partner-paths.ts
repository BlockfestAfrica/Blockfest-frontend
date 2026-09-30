import { CONTACT_EMAIL } from "@/lib/constants";

/**
 * The ways to partner with Blockfest Africa 2026, one per kind of partner.
 *
 * Large conference sites (TOKEN2049, Web Summit, GITEX) invite each kind of
 * partner with its own call to action rather than by growing a section per
 * kind on the page: "Become a Sponsor", "Media Partnership", "Apply for
 * community partnership".
 *
 * `href` is where the button goes. Sponsors go to the sponsorship section,
 * which offers the deck by email or Telegram. The others open an email to
 * the partnerships inbox with the subject filled in; when an application
 * form exists for one, put its URL here and nothing else needs to change.
 */
export interface PartnerPath {
  id: "sponsor" | "media" | "community" | "institution";
  title: string;
  blurb: string;
  /** The button's visible words. */
  action: string;
  /** Its full name for a screen reader, starting with `action`. */
  label: string;
  href: string;
}

const email = (subject: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${subject} - Blockf3st Africa 2026`)}`;

export const partnerPaths: PartnerPath[] = [
  {
    id: "sponsor",
    title: "Sponsor",
    blurb:
      "Put your brand in front of the builders, founders and decision makers at Blockfest Africa 2026.",
    action: "Get the deck",
    label: "Get the deck, with the sponsorship packages",
    href: "/#sponsorship",
  },
  {
    id: "media",
    title: "Media partner",
    blurb:
      "Cover Blockfest Africa 2026 in Lagos this October for your readers, listeners or followers.",
    action: "Email us",
    label: "Email us about a media partnership",
    href: email("Media Partnership"),
  },
  {
    id: "community",
    title: "Community partner",
    blurb:
      "Bring your community to Blockfest Africa 2026 and build the festival with us.",
    action: "Email us",
    label: "Email us about a community partnership",
    href: email("Community Partnership"),
  },
  {
    id: "institution",
    title: "Government & institutions",
    blurb:
      "Government bodies, agencies and associations working on Africa's technology ecosystem.",
    action: "Email us",
    label: "Email us about an institutional partnership",
    href: email("Institutional Partnership"),
  },
];
