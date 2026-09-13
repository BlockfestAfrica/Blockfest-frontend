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
 * Strip the tracking tail a share sheet adds, for display.
 *
 * This is tidying, not a rule. It used to be the rule, and that was the bug:
 * uniqueness compared the string this returns, so every other spelling of the
 * same post counted as a new entry. twitter.com against x.com, a capital in the
 * handle, /statuses/ against /status/, a /photo/1 suffix, reel against p. Each
 * was full points for work done once, repeatable every week.
 *
 * Uniqueness now lives on submissions.post_identity, a generated column added
 * in 0023 that extracts the id the platform itself uses. It is computed by the
 * database so a caller cannot bypass it and so there is no second copy of the
 * rule here to drift from it. What this function returns is what a reviewer
 * clicks, and it no longer decides anything.
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

/**
 * The account a post was published from, read out of its own URL.
 *
 * X and TikTok both carry the author in the path, so a link can be compared
 * against the handle the creator registered. Instagram does not: a post is
 * /p/<shortcode>/ and a reel is /reel/<shortcode>/, with the author nowhere in
 * the address, so there is nothing to compare and this returns null rather than
 * guessing.
 *
 * This is a comparison, not verification. Nothing in the system has ever proved
 * that a registered handle belongs to the person who registered it: 0002 says
 * an unverified handle must not be used to attribute an entry, and verified_at
 * is still never set. So this stops somebody submitting a rival's post under
 * their own unrelated handle, which is the easy attack. It does not stop
 * somebody who registers the rival's handle in the first place. That needs
 * handle verification, which is a separate piece of work.
 */
export function authorFromUrl(
  url: string,
  platform: CampaignPlatform,
): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (platform === "x") {
    // x.com/<handle>/status/<id>. A short link with no author segment, or one
    // of the site's own pages, yields nothing to compare.
    const first = segments[0].toLowerCase();
    if (["i", "home", "search", "hashtag", "intent"].includes(first)) {
      return null;
    }
    return first.replace(/^@/, "") || null;
  }

  if (platform === "tiktok") {
    // tiktok.com/@<handle>/video/<id>. The short domains, vm. and vt., encode
    // no author at all and resolve only by following the redirect.
    const at = segments.find((seg) => seg.startsWith("@"));
    return at ? at.slice(1).toLowerCase() || null : null;
  }

  // Instagram: the author is not in the URL.
  return null;
}
