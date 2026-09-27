import { FaInstagram, FaTiktok, FaXTwitter } from "react-icons/fa6";
import type { CampaignPlatform } from "@/lib/campaigns";

/**
 * Each platform's mark, for anywhere a post or an account is shown.
 *
 * One map, not a copy per screen: the leaderboard, the admin nominee picker
 * and the public ballot all draw these, and three private copies are three
 * places for a fourth platform to be forgotten.
 */
export const PLATFORM_ICON: Record<CampaignPlatform, typeof FaXTwitter> = {
  x: FaXTwitter,
  instagram: FaInstagram,
  tiktok: FaTiktok,
};
