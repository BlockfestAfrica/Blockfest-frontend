/**
 * "If ROVV Takes Me to Blockfest…": Rovv's TikTok campaign (the owner, 12
 * October 2026, from Rovv's brief).
 *
 * One round, 13 to 18 October in Lagos. A person makes an original TikTok on
 * the prompt, posts it publicly tagging @rovvafrica and @blockfestafrica with
 * #ROVVMeToBlockfest, registers on the ROVV app, then enters here once with
 * their name, email, TikTok username, the video's link and their ROVV
 * referral code. The team marks entries eligible or not and picks 20
 * winners, a BUIDL PASS each, announced by 4 PM on 19 October; their TikTok
 * usernames then show on the campaign page.
 *
 * Decided with the owner on 12 October: one entry per person (by email), 18
 * or over and able to attend in Lagos, every entry shared with Rovv to
 * confirm the referral codes. The database side is
 * netlify/database/migrations/0073_rovv_campaign.sql.
 */
import { z } from "zod";
import { canonicalEmail, canonicalHandle } from "@/lib/campaign-registration";
import { canonicalUrl } from "@/lib/campaign-submission";

export const ROVV_SLUG = "rovv";

export const ROVV = {
  title: "If ROVV Takes Me to Blockfest…",
  sponsor: "ROVV",
  hashtag: "#ROVVMeToBlockfest",
  rovvHandle: "@rovvafrica",
  blockfestHandle: "@blockfestafrica",
  rovvUrl: "https://x.com/rovvafrica",
  /** How many entries win, one ticket each. */
  winners: 20,
  /** Entries open and close, Lagos time. The database holds the same (0073). */
  opensAt: "2026-10-13T00:00:00+01:00",
  closesAt: "2026-10-18T23:59:59+01:00",
  /** Winners are emailed, and listed on the page, by this time (the owner, 12 October). */
  winnersBy: "2026-10-19T16:00:00+01:00",
  /** The same, as every page and email says it. */
  winnersByLabel: "4 PM on Monday 19 October",
  /** The prize, as the owner set it on 12 October: Day 2 only. */
  prize: "BUIDL PASS",
  prizeDay: "Day 2, Conference Day, on Friday 23 October",
  /**
   * Where to get the ROVV app. Null until ROVV gives us the store links; the
   * page then says to search for ROVV in the store rather than guess a URL.
   */
  appLinks: { android: null as string | null, ios: null as string | null },
} as const;

export const rovvRoutes = {
  home: `/campaigns/${ROVV_SLUG}`,
  enter: `/campaigns/${ROVV_SLUG}#enter`,
  rules: `/campaigns/${ROVV_SLUG}/rules`,
  privacy: `/campaigns/${ROVV_SLUG}/privacy`,
} as const;

/** Where entries stand in review. The database's CHECK lists the same (0073). */
export const ROVV_ENTRY_STATUSES = ["pending", "eligible", "ineligible"] as const;
export type RovvEntryStatus = (typeof ROVV_ENTRY_STATUSES)[number];

/** Whether entries are open at `now` (the route and the form both ask). */
export function rovvOpen(now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= new Date(ROVV.opensAt).getTime() && t <= new Date(ROVV.closesAt).getTime();
}

/* ------------------------------------------------------------------ */
/* The video's link                                                   */
/* ------------------------------------------------------------------ */

const TIKTOK_HOSTS = ["tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];

/**
 * A TikTok video link, as someone pastes it. Accepted: the full form
 * (tiktok.com/@username/video/123…) and the short forms the TikTok app's
 * Copy link produces (vm.tiktok.com/…, vt.tiktok.com/…, tiktok.com/t/…).
 * Unlike Monica, short links are welcome: this campaign is TikTok only, and
 * on a phone the short link is what people have. A reviewer opens it either
 * way. Returns the link tidied, or null with why it was refused.
 */
export function readTikTokLink(raw: string): { url: string } | { error: string } {
  /* TikTok's share sheet often copies a sentence around the link ("Check out
     this video! https://vm.tiktok.com/abc/ #fyp"), so the first link in what
     was pasted is the one read, without the punctuation after it. */
  const found = raw.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  const text = (found ?? raw).trim().replace(/[).,!?;:]+$/, "");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "Paste the link to your TikTok video, starting with https://" };
  }
  if (url.protocol !== "https:") return { error: "The link should start with https://" };
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!TIKTOK_HOSTS.includes(host)) return { error: "That is not a TikTok link. Paste your TikTok video's link." };
  const path = url.pathname.split("/").filter(Boolean);
  const short = host === "vm.tiktok.com" || host === "vt.tiktok.com";
  if (short) {
    if (path.length !== 1 || !/^[A-Za-z0-9]{5,20}$/.test(path[0])) {
      return { error: "That TikTok link looks cut short. Copy it again from the app." };
    }
    return { url: `https://${host}/${path[0]}` };
  }
  if (path[0] === "t" && path.length === 2 && /^[A-Za-z0-9]{5,20}$/.test(path[1])) {
    return { url: `https://tiktok.com/t/${path[1]}` };
  }
  if (path.length >= 3 && path[0].startsWith("@") && path[1] === "video" && /^\d{8,25}$/.test(path[2])) {
    return { url: canonicalUrl(`https://tiktok.com/${path.slice(0, 3).join("/")}`) };
  }
  return { error: "Paste the link to one TikTok video, not a profile or a sound." };
}

/** The username a full video link names (tiktok.com/@name/video/…), or null for a short link. */
export function tiktokAuthor(url: string): string | null {
  try {
    const first = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    return first.startsWith("@") ? first.slice(1).toLowerCase() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The form                                                           */
/* ------------------------------------------------------------------ */

/**
 * The entry form, checked the same in the browser and on the server. Every
 * field the brief asks for, the consent box, the optional newsletter box and
 * the two bot checks Monica's form carries (a hidden field and a time floor).
 */
/** The form's fields before the cross-checks, for the privacy notice's test to enumerate. */
export const rovvEntryFields = z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(120, "That name is too long.")
      // It heads the receipt email, so it may not be a link in disguise.
      .refine((v) => !/(https?:|www\.|\.[a-z]{2,}\/|@)/i.test(v), {
        message: "Enter your name as it should appear on a ticket.",
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "That email address is too long.")
      .email("Enter a valid email address."),
    tiktokHandle: z
      .string()
      .trim()
      .max(120, "That looks too long for a username.")
      .transform((v) => canonicalHandle(v))
      .refine((v) => /^[a-z0-9._]{2,24}$/.test(v), {
        message: "Enter your TikTok username, for example yourname.",
      }),
    tiktokUrl: z.string().trim().min(1, "Paste the link to your TikTok video.").max(500, "That link is too long."),
    /* Kept as typed, case and all, with only spaces taken out: we do not
       know whether ROVV's codes are case-sensitive, and changing one would
       be worse than storing it as the person copied it. */
    referralCode: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => /^[A-Za-z0-9._-]{3,40}$/.test(v), {
        message: "Enter your ROVV referral code exactly as the app shows it.",
      }),
    acceptedRules: z.literal(true, { message: "Tick the box to confirm the rules and your eligibility." }),
    rulesVersion: z.string().min(1),
    privacyVersion: z.string().min(1),
    marketingOptIn: z.boolean().optional().default(false),
    hp_contact: z.string().optional(),
    elapsedMs: z.number().optional(),
});

export const rovvEntrySchema = rovvEntryFields
  .superRefine((v, ctx) => {
    const link = readTikTokLink(v.tiktokUrl);
    if ("error" in link) {
      ctx.addIssue({ code: "custom", path: ["tiktokUrl"], message: link.error });
      return;
    }
    const author = tiktokAuthor(link.url);
    if (author && author !== v.tiktokHandle) {
      ctx.addIssue({
        code: "custom",
        path: ["tiktokUrl"],
        message: `That video is from @${author}. Enter the video you posted from @${v.tiktokHandle}, or correct your username.`,
      });
    }
  })
  .transform((v) => {
    const link = readTikTokLink(v.tiktokUrl) as { url: string };
    return { ...v, tiktokUrl: link.url, emailCanonical: canonicalEmail(v.email) };
  });

export type RovvEntryInput = z.input<typeof rovvEntrySchema>;
export type RovvEntry = z.output<typeof rovvEntrySchema>;

/* ------------------------------------------------------------------ */
/* An email address that is probably mistyped                          */
/* ------------------------------------------------------------------ */

const DOMAIN_TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yahoo.con": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmail.con": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlook.con": "outlook.com",
  "icloud.con": "icloud.com",
};

/**
 * "Did you mean ada@gmail.com?" for the domains people mistype most. Every
 * email about an entry (the ruling, a fix, a winner's code) goes only to
 * this address, and nothing checks it, so a typo is caught where it is made.
 * A suggestion, never a refusal: an address can be odd and still be right.
 */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  const fixed = DOMAIN_TYPOS[domain];
  return fixed ? `${email.trim().slice(0, at)}@${fixed}` : null;
}
