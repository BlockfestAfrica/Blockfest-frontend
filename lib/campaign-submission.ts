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
/**
 * Percent-escapes in the path collapse before anything is stored.
 *
 * The platforms treat x.com/ada/status/12%339 as the same post as .../1239,
 * but post_identity is computed from the stored string, so the encoded
 * spelling minted a fresh identity: the same post, credited again. Decoding
 * until stable (three rounds bounds a %25-tower) means every spelling of a
 * path stores identically and the identity column sees one post once.
 */
function decodedPath(path: string): string {
  let current = path;
  for (let round = 0; round < 3; round++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      // Malformed escapes stay as typed; the URL was probably not a real
      // post link and later checks will say so in their own words.
      return current;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
}

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.search = "";
    url.hostname = bareHost(url.hostname);
    // Composed by hand: assigning a decoded pathname back onto URL would
    // re-encode it, which is the spelling this exists to remove.
    const path = decodedPath(url.pathname).replace(/\/$/, "");
    return `${url.protocol}//${url.hostname}${path}`;
  } catch {
    return raw.trim();
  }
}

/**
 * Whether the stored form of a link opens the post it will be counted as.
 *
 * decodedPath runs after the URL parser has already resolved the path, and the
 * result is composed by hand, so an escape can decode into structure no parser
 * saw. x.com/me/status/888%2F..%2F..%2Fstatus/555 stored as
 * /me/status/888/../../status/555: the reviewer's browser and authorFromUrl
 * resolve that to post 555, while post_identity_of takes the first id in the
 * raw text, 888. The ownership check passed on one post and the identity named
 * another, so a post already credited could be credited again under a fresh
 * identity, or a rival's id held so that their own filing was refused.
 * %252e%252e reaches the same place without a slash, a decoded ?, # or
 * backslash moves the line between path, query and fragment, and a decoded tab
 * or newline is dropped by the parser outright.
 *
 * Refused rather than repaired, because a repair is a guess at which post was
 * meant and the attacker chooses what the guess sees. The test is the general
 * one rather than a list of characters: decoding must not add a separator
 * nobody typed, no escape may survive decoding (a malformed one stops it part
 * way and leaves %2F for the platform to read however it likes), and the
 * stored form has to parse back into itself, which it only does when no parser
 * has anything left to resolve, split or strip. No link a share sheet
 * produces trips any of them.
 */
function canonicalIsSettled(raw: string): boolean {
  let typed: string;
  try {
    typed = new URL(raw.trim()).pathname;
  } catch {
    return false;
  }
  const segments = (path: string) => path.split(/[/\\]/).length;
  if (segments(decodedPath(typed)) !== segments(typed)) return false;

  const stored = canonicalUrl(raw);
  return !stored.includes("%") && canonicalUrl(stored) === stored;
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
  .refine(
    (v) =>
      hostMatchesPlatform(v.url, v.platform as CampaignPlatform) &&
      // Again on the stored form, because that is the one a reviewer opens.
      hostMatchesPlatform(canonicalUrl(v.url), v.platform as CampaignPlatform),
    {
      // Named against url, because that is the field they will fix.
      path: ["url"],
      message: "That link does not match the platform you picked.",
    },
  )
  /*
   * X and TikTok links must arrive in their authored form.
   *
   * An authorless form (x.com/i/status/..., a vt.tiktok.com share link)
   * skipped the wrong_account comparison entirely, and TikTok share links
   * also minted a URL-shaped post identity distinct from the canonical
   * video, worth a second credit. Refusing them costs the creator one
   * copy-paste of the full link from their own post; accepting them costs
   * the ownership check its meaning. Instagram never names the author in a
   * link, so review carries that platform and it is exempt here.
   */
  .refine(
    (v) =>
      v.platform === "instagram" ||
      authorFromUrl(canonicalUrl(v.url), v.platform as CampaignPlatform) !==
        null,
    {
      path: ["url"],
      message:
        "Paste the full link from your post, the one with your username in it. Short links and x.com/i/ links hide who posted it.",
    },
  )
  /*
   * Last, so a link that is wrong in a more ordinary way is told that first.
   * A real share link never fails this; one that does is either mangled by
   * whatever it was pasted through or built to open a different post from
   * the one it would be counted as, and the fix is the same either way.
   */
  .refine((v) => canonicalIsSettled(v.url), {
    path: ["url"],
    message:
      "That link has encoded characters a post link never has, so we cannot tell which post it opens. Copy the link again from your post and paste it as it is.",
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * The account a link names, read out of its path. Not, on its own, the
 * account that published the post.
 *
 * X and TikTok links carry a handle in the path, so a link can be compared
 * against the handle the creator registered. Instagram does not: a post is
 * /p/<shortcode>/ and a reel is /reel/<shortcode>/, with the author nowhere in
 * the address, so there is nothing to compare and this returns null rather than
 * guessing.
 *
 * This is a comparison, not verification, and it is weaker than it looks. The
 * handle is whatever the submitter typed, and nothing ties it to the post:
 * post_identity_of keys the post on the status or video number alone, so
 * x.com/<own handle>/status/<a rival's number> names the submitter and files
 * the rival's post. What the comparison catches is a rival's link pasted as it
 * is, and the honest mistake of pasting a post from the wrong account. Who
 * published a post is settled by a reviewer looking at the author the platform
 * shows, which is why the review queue does not treat a match here as a check.
 *
 * Nor has anything proved that a registered handle belongs to the person who
 * registered it: 0002 says an unverified handle must not be used to attribute
 * an entry, and verified_at is still never set. That needs handle
 * verification, which is a separate piece of work.
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
