import { z } from "zod";
import { CAMPAIGN_PLATFORMS, type CampaignPlatform } from "@/lib/campaigns";

/**
 * What a creator submits: a platform, and a link to the post.
 *
 * The link is the whole entry. We do not host anything, so if this is wrong
 * there is nothing to review, and the creator finds out days later when the
 * entry is rejected for a reason that was a typo.
 */

/**
 * Hosts we accept per platform.
 *
 * Checked because the commonest mistake is picking the wrong platform in the
 * dropdown, not pasting a bad link, and that mistake is invisible to the person
 * making it. Catching it here costs them a second; catching it at review costs
 * them the week.
 *
 * Deliberately generous about subdomains and short forms: vm.tiktok.com and
 * twitter.com are what real share sheets produce, and refusing them would be
 * refusing correct entries.
 */
const HOSTS: Record<CampaignPlatform, readonly string[]> = {
  x: ["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"],
  instagram: ["instagram.com", "instagr.am"],
  tiktok: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"],
};

/** `www.` is noise on every one of these. */
function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function hostMatchesPlatform(
  url: string,
  platform: CampaignPlatform,
): boolean {
  let host: string;
  try {
    host = bareHost(new URL(url).hostname);
  } catch {
    return false;
  }
  return HOSTS[platform].some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Strip the tracking tail a share sheet adds.
 *
 * Two creators sharing the same post produce different strings for it, and the
 * uniqueness index compares strings. Without this, `?igsh=...` is enough to
 * submit somebody else's post alongside theirs and have both look distinct.
 *
 * Only the query and fragment go. The path is untouched, because on these
 * platforms the path is the post.
 */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.search = "";
    url.hostname = bareHost(url.hostname);
    // A trailing slash is not a different post.
    const clean = url.toString().replace(/\/$/, "");
    return clean;
  } catch {
    return raw.trim();
  }
}

export const submissionSchema = z
  .object({
    platform: z.enum(CAMPAIGN_PLATFORMS as unknown as [string, ...string[]], {
      message: "Choose where you published this.",
    }),
    url: z
      .string()
      .trim()
      .min(1, "Paste the link to your post.")
      .max(500, "That link is too long to be a post.")
      .refine((u) => /^https:\/\//i.test(u), {
        message: "The link has to start with https://",
      })
      .refine(
        (u) => {
          try {
            new URL(u);
            return true;
          } catch {
            return false;
          }
        },
        { message: "That does not look like a link. Paste the whole address." },
      ),
  })
  .refine((v) => hostMatchesPlatform(v.url, v.platform as CampaignPlatform), {
    // Named against url, because that is the field they will fix.
    path: ["url"],
    message: "That link does not match the platform you picked.",
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;
