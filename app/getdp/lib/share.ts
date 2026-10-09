/**
 * Sharing and saving the DP: which device this is, what each control does on
 * it, and every sentence the page says about it. Pure, no DOM, so all of it is
 * unit tested in __tests__/unit/getdp-share.test.ts.
 *
 * What a website can and cannot do, said once (app/getdp/README.md says it at
 * length): links to X, LinkedIn and TikTok carry text, never an image, and
 * their posting APIs want the image uploaded to a server first, which the
 * privacy rule forbids. The only way to hand the picture straight to an app is
 * the phone's share list (navigator.share with the file). Everything else is
 * honest about being a few steps: save the DP, copy the caption, open the app,
 * attach the DP. Nothing here says, or may come to say, that we post or upload
 * anything for anybody.
 */
import { xIntentUrl } from "./dp";

export { xIntentUrl };

/* ------------------------------------------------------------------ */
/* Platforms                                                          */
/* ------------------------------------------------------------------ */

export type Platform = "x" | "instagram" | "tiktok" | "linkedin" | "whatsapp";

/** The order the marks stand in. */
export const PLATFORMS: readonly Platform[] = ["x", "instagram", "tiktok", "linkedin", "whatsapp"];

export const PLATFORM_NAME: Record<Platform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

/** A post's compose page; the person attaches the DP there themselves. */
export const LINKEDIN_COMPOSE = "https://www.linkedin.com/feed/";
export const INSTAGRAM_WEB = "https://www.instagram.com/";
/** TikTok's web upload page. Photo posts there are a device check before merge. */
export const TIKTOK_UPLOAD = "https://www.tiktok.com/tiktokstudio/upload";

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/* ------------------------------------------------------------------ */
/* Timing and format                                                  */
/* ------------------------------------------------------------------ */

/** JPEG quality for a phone's share list: about a fifth of the PNG's bytes. */
export const SHARE_QUALITY = 0.92;
/** The full picture is drawn this long after the last change. */
export const RENDER_DEBOUNCE_MS = 300;
/** A second Download tap on the same picture inside this is ignored. */
export const DOWNLOAD_GUARD_MS = 2000;
/** A download's object URL lives this long (iOS asks "Download?" first). */
export const REVOKE_AFTER_MS = 60_000;

/* ------------------------------------------------------------------ */
/* The device                                                         */
/* ------------------------------------------------------------------ */

/** Browsers inside another app, where downloads usually fail. */
export const IN_APP =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|BytedanceWebview|musical_ly|trill_|TikTok|LinkedInApp|Snapchat|Line\/|; wv\)/i;

/** The app whose browser this is, by name, or null when it says nothing. */
export function appName(ua: string): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "Facebook";
  if (/BytedanceWebview|musical_ly|trill_|TikTok/i.test(ua)) return "TikTok";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/Line\//.test(ua)) return "LINE";
  return null;
}

export interface ShareEnv {
  /** iPhone, iPad (which says Macintosh) or iPod. */
  ios: boolean;
  android: boolean;
  /** A browser inside another app. */
  inApp: boolean;
  /** That app's name, when the browser gives it. */
  app: string | null;
  /** A coarse primary pointer: a phone or tablet. */
  phone: boolean;
  /** navigator.share accepts an image file here. */
  fileShare: boolean;
  /** What a share hands over: JPEG on a phone that shares files, else PNG. */
  shareType: "image/jpeg" | "image/png";
}

/**
 * What the server renders and the first paint shows: a desktop with nothing
 * to share. Every control is shut until there is a picture anyway, so the
 * swap after hydration changes nothing anybody has touched.
 */
export const DESKTOP_ENV: ShareEnv = {
  ios: false,
  android: false,
  inApp: false,
  app: null,
  phone: false,
  fileShare: false,
  shareType: "image/png",
};

export function detectEnv(probe: {
  ua: string;
  maxTouchPoints: number;
  coarse: boolean;
  canShareJpeg: boolean;
  canSharePng: boolean;
}): ShareEnv {
  const { ua, maxTouchPoints, coarse, canShareJpeg, canSharePng } = probe;
  const inApp = IN_APP.test(ua);
  return {
    ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1),
    android: /Android/i.test(ua),
    inApp,
    app: inApp ? appName(ua) : null,
    phone: coarse,
    fileShare: canShareJpeg || canSharePng,
    shareType: coarse && canShareJpeg ? "image/jpeg" : "image/png",
  };
}

/**
 * The four kinds of device the controls are chosen for.
 * - sheet (A): a phone whose share list takes the file.
 * - download (B): a phone in a normal browser that cannot share files.
 * - hold (C): an in-app browser that cannot share files.
 * - desktop (D): a fine pointer.
 */
export type DeviceClass = "sheet" | "download" | "hold" | "desktop";

export function deviceClass(env: ShareEnv): DeviceClass {
  if (!env.phone) return "desktop";
  if (env.fileShare) return "sheet";
  return env.inApp ? "hold" : "download";
}

/**
 * How the "Post it on" marks behave here: as the device's class, except on
 * an iPhone that cannot share files (Lockdown Mode, an old iOS). A download
 * there goes to Files, where the apps' photo pickers never look, so the
 * marks open the press-and-hold picture, which saves to Photos, as Save to
 * Photos does.
 */
export function marksClass(env: ShareEnv): DeviceClass {
  const cls = deviceClass(env);
  return cls === "download" && env.ios ? "hold" : cls;
}

/* ------------------------------------------------------------------ */
/* The buttons                                                        */
/* ------------------------------------------------------------------ */

export type ButtonId = "share" | "photos" | "download" | "save" | "more";
export type ButtonIntent = "primary" | "secondary" | "quiet";

/** The save and share buttons for this device, in order; exactly one primary. */
export function buttonsFor(env: ShareEnv): { id: ButtonId; intent: ButtonIntent }[] {
  switch (deviceClass(env)) {
    case "sheet":
      if (env.ios) {
        return env.inApp
          ? [
              { id: "share", intent: "primary" },
              { id: "photos", intent: "secondary" },
            ]
          : [
              { id: "share", intent: "primary" },
              { id: "photos", intent: "secondary" },
              { id: "download", intent: "quiet" },
            ];
      }
      return env.inApp
        ? [{ id: "share", intent: "primary" }]
        : [
            { id: "share", intent: "primary" },
            { id: "download", intent: "secondary" },
          ];
    case "download":
      return env.ios
        ? [
            { id: "download", intent: "primary" },
            { id: "photos", intent: "secondary" },
          ]
        : [{ id: "download", intent: "primary" }];
    case "hold":
      return [{ id: "save", intent: "primary" }];
    case "desktop":
      return env.fileShare
        ? [
            { id: "download", intent: "primary" },
            { id: "more", intent: "quiet" },
          ]
        : [{ id: "download", intent: "primary" }];
  }
}

export const BUTTON_LABEL: Record<ButtonId, string> = {
  share: "Share your DP",
  photos: "Save to Photos",
  download: "Download PNG",
  save: "Save image",
  more: "Share…",
};

/* ------------------------------------------------------------------ */
/* The marks                                                          */
/* ------------------------------------------------------------------ */

export interface PlatformAction {
  /**
   * sheet: open the share list with the file. link: a real link (the page
   * also saves the DP and copies the caption). save: save and copy, no link.
   * hold: copy, then the press-and-hold picture.
   */
  kind: "sheet" | "link" | "save" | "hold";
  href?: string;
  /** Whether a tap also starts the PNG download. */
  download: boolean;
  /** What to do next, said after the tap. */
  tip: string;
}

const TIPS_SHEET: Record<Platform, string> = {
  x: "Pick X. If your caption isn't in the post, paste it.",
  instagram: "Pick Instagram (Feed or Stories), then paste your caption.",
  tiktok: "",
  linkedin: "Pick LinkedIn, then paste your caption: LinkedIn leaves it out.",
  whatsapp: "Pick WhatsApp, then a chat or My status. Paste your caption if it's missing.",
};
const TIKTOK_SHEET_IOS = "Pick TikTok. Not in the list? Choose Save Image, then post it from TikTok with +.";
const TIKTOK_SHEET_ANDROID = "Pick TikTok. Not in the list? Use Download PNG, then post it from TikTok with +.";

const TIPS_DOWNLOAD: Record<Platform, string> = {
  x: "Attach the DP you just saved, then post.",
  linkedin: "Start a post, add the DP you just saved and paste your caption.",
  whatsapp: "Pick a chat, attach the DP you just saved and send.",
  tiktok: "Open TikTok, tap +, choose your DP and paste your caption.",
  instagram: "Open Instagram, tap +, choose your DP and paste your caption.",
};

const TIPS_DESKTOP: Record<Platform, (file: string) => string> = {
  x: (file) => `X is open in a new tab with your caption. Attach your DP (${file}) from Downloads, then post.`,
  instagram: () => "Instagram is open in a new tab. Choose Create, add your DP from Downloads and paste your caption.",
  tiktok: () => "TikTok is open in a new tab. Upload your DP as a photo post and paste your caption.",
  linkedin: () => "LinkedIn is open in a new tab. Start a post, add your DP from Downloads and paste your caption.",
  whatsapp: () => "WhatsApp is open with your caption. Pick a chat, attach your DP from Downloads and send.",
};

/** The web page a mark opens on a desktop. */
function webHref(p: Platform, caption: string): string {
  switch (p) {
    case "x":
      return xIntentUrl(caption);
    case "linkedin":
      return LINKEDIN_COMPOSE;
    case "whatsapp":
      return whatsappUrl(caption);
    case "instagram":
      return INSTAGRAM_WEB;
    case "tiktok":
      return TIKTOK_UPLOAD;
  }
}

/** What tapping a platform's mark does on this device. */
export function platformAction(
  p: Platform,
  env: ShareEnv,
  caption: string,
  fileName: string,
): PlatformAction {
  switch (marksClass(env)) {
    case "sheet":
      return {
        kind: "sheet",
        download: false,
        tip: p === "tiktok" ? (env.ios ? TIKTOK_SHEET_IOS : TIKTOK_SHEET_ANDROID) : TIPS_SHEET[p],
      };
    case "download":
      // Neither TikTok nor Instagram has a page to post from on a phone.
      return p === "tiktok" || p === "instagram"
        ? { kind: "save", download: true, tip: TIPS_DOWNLOAD[p] }
        : { kind: "link", href: webHref(p, caption), download: true, tip: TIPS_DOWNLOAD[p] };
    case "hold":
      return { kind: "hold", download: false, tip: COPY.holdPlatform(PLATFORM_NAME[p]) };
    case "desktop":
      return { kind: "link", href: webHref(p, caption), download: true, tip: TIPS_DESKTOP[p](fileName) };
  }
}

/* ------------------------------------------------------------------ */
/* WhatsApp Status                                                    */
/* ------------------------------------------------------------------ */

export interface StatusAction {
  /**
   * sheet: open the share list with the file, where WhatsApp offers My
   * status. save: save and copy. hold: copy, then the press-and-hold picture.
   */
  kind: "sheet" | "save" | "hold";
  /** Said under the button, before it is tapped. */
  how: string;
}

/**
 * The WhatsApp Status button, on a phone only: Status is posted from the
 * phone app, and no link opens it. The share list is the one way to hand
 * the picture to it; elsewhere the page saves the DP and says where Status
 * is in WhatsApp.
 */
export function statusAction(env: ShareEnv): StatusAction | null {
  switch (marksClass(env)) {
    case "sheet":
      return { kind: "sheet", how: COPY.statusSheet };
    case "download":
      return { kind: "save", how: COPY.statusSave };
    case "hold":
      return { kind: "hold", how: COPY.statusHold };
    case "desktop":
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Share data                                                         */
/* ------------------------------------------------------------------ */

/**
 * What goes to navigator.share. Never a title or a URL. Files only, except on
 * Android when the browser accepts text beside them: Chrome hands the caption
 * on, so X and WhatsApp open with it. On an Apple device any text hides Save
 * Image and makes some apps take the words instead of the picture.
 */
export function shareData(
  file: File,
  env: ShareEnv,
  caption: string,
  canShare?: (data: ShareData) => boolean,
): ShareData {
  if (env.android && !env.ios && canShare) {
    const withText = { files: [file], text: caption };
    try {
      if (canShare(withText)) return withText;
    } catch {
      /* files only */
    }
  }
  return { files: [file] };
}

/** Opens a page in Chrome from an Android in-app browser. */
export function chromeIntentUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  const scheme = u.protocol.replace(/:$/, "");
  return `intent://${u.host}${u.pathname}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(pageUrl)};end`;
}

/* ------------------------------------------------------------------ */
/* The in-app browser notice                                          */
/* ------------------------------------------------------------------ */

export interface InAppNoticeCopy {
  title: string;
  body: string;
  /** Offer "Open in Chrome" (Android). */
  chrome: boolean;
}

export function inAppNotice(env: ShareEnv): InAppNoticeCopy | null {
  if (!env.inApp) return null;
  const tiktok = env.app === "TikTok";
  const whose = env.app ? `${env.app}'s` : "This app's";
  if (env.ios) {
    if (env.fileShare) {
      return {
        title: `Saving may not work in ${env.app ? `${env.app}'s` : "this app's"} browser`,
        body: tiktok
          ? "If it doesn't, copy the link and paste it into Safari."
          : "If it doesn't, tap ••• at the top, then Open in browser.",
        chrome: false,
      };
    }
    return {
      title: "Open this page in Safari",
      body: tiktok
        ? "Copy the link, then paste it into Safari."
        : `${whose} browser can't save your DP. Tap ••• at the top, then Open in browser.`,
      chrome: false,
    };
  }
  if (env.android) {
    if (env.fileShare) {
      return {
        title: `Saving may not work in ${env.app ? `${env.app}'s` : "this app's"} browser`,
        body: "If it doesn't, tap ⋮ at the top, then Open in Chrome.",
        chrome: true,
      };
    }
    return {
      title: "Open this page in Chrome",
      body: env.app
        ? `${env.app}'s browser can't save your DP. Tap ⋮ at the top, then Open in Chrome.`
        : "This app's browser can't save your DP. Tap ⋮ at the top, then Open in browser.",
      chrome: true,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Words                                                              */
/* ------------------------------------------------------------------ */

/** What the page says about moving the photo, given how far it can move. */
export function moveHint(limits: { maxX: number; maxY: number }, coarse: boolean): string {
  const x = limits.maxX > 1e-6;
  const y = limits.maxY > 1e-6;
  const first = !x && !y
    ? "Your photo fills its frame. Zoom in to move it."
    : !x
      ? "Drag your photo up or down to move it. Zoom in to move it sideways too."
      : !y
        ? "Drag your photo sideways to move it. Zoom in to move it up and down too."
        : "Drag your photo to move it in its frame.";
  return `${first}${coarse ? " Pinch to zoom." : " On a keyboard, the arrow keys move it."}`;
}

/** Every sentence about saving and sharing (the name and photo ones stay in the page). */
export const COPY = {
  frameLabel: "Your DP. Drag your photo, or use the arrow keys, to move it in its frame; plus and minus zoom.",
  moveGroup: "Move your photo",

  assetsError: "The picture could not be prepared. Check your connection and try again.",
  fontsError: "The picture's lettering did not load. Check your connection and try again.",
  tryAgain: "Try again",

  preparing: "Preparing…",
  saving: "Saving…",

  needsNameAndPhoto: "Add your name and a photo to get your DP.",
  needsName: "Add your name to get your DP.",
  fixNameAndPhoto: "Fix your name and add a photo to get your DP.",
  fixName: "Fix your name to get your DP.",
  needsPhoto: "Add a photo to get your DP.",
  openingPhoto: "Opening your photo…",
  preparingDP: "Preparing your DP…",
  needsRetry: "Tap Try again to finish your DP.",

  ready(cls: DeviceClass): string {
    if (cls === "sheet") return "Ready to share";
    if (cls === "hold") return "Ready to save";
    return "Ready to download";
  },
  /** Whether the ready line goes on to name the file. */
  readyNamesFile(cls: DeviceClass): boolean {
    return cls === "desktop" || cls === "download";
  },

  profile(env: ShareEnv): string {
    if (env.inApp) return "For your profile picture, save it, then choose it in your app's Edit profile.";
    if (env.phone && env.ios) return "For your profile picture, save it to Photos, then choose it in your app's Edit profile.";
    if (env.phone) return "For your profile picture, download it, then choose it in your app's Edit profile.";
    return "For your profile picture, upload the PNG in your profile settings.";
  },

  tapAgain: "Tap again to open the share list.",
  choosePhotos: "Choose Save Image in the list to put it in Photos.",
  shareFailed: "Sharing didn't work in this browser. Use Download PNG, then post it from your gallery.",
  shareFailedHold: "Sharing didn't work here. Press and hold your DP to save it.",
  copyFailedAuto: "Couldn't copy your caption. Copy it from the box below.",
  notSaved: "The picture could not be saved. Try again.",

  downloading(env: ShareEnv, file: string): string {
    if (env.phone && env.ios) {
      return `Downloading ${file}. On iPhone it goes to Files, in Downloads. For Photos, use Save to Photos.`;
    }
    if (env.phone && env.android) return `Downloading ${file}. Look for it in Downloads.`;
    return `Downloading ${file}.`;
  },

  postLabel: "Post it on",
  markLabel(p: Platform): string {
    return p === "whatsapp" ? "Send on WhatsApp" : `Post on ${PLATFORM_NAME[p]}`;
  },
  /**
   * What the marks do, said before any is tapped: what each tap does, never
   * that it is done ("Your caption is copied" would be untrue until a tap,
   * and after a copy the browser refused).
   */
  marksDo(cls: DeviceClass): string {
    switch (cls) {
      case "sheet":
        return "Each opens your phone's share list with your DP and copies your caption: paste it into the post.";
      case "desktop":
        return "Each downloads your DP, copies your caption and opens the site in a new tab. Attach the DP and paste.";
      case "download":
        return "Each saves your DP and copies your caption. Then attach the DP in the app and paste.";
      case "hold":
        return "Save your DP first, then post it in the app. Each copies your caption.";
    }
  },

  statusLabel: "Post to WhatsApp Status",
  statusSheet: "Opens your share list with your DP: choose WhatsApp, then My status at the top.",
  statusSave: "Saves your DP and copies your caption. Then in WhatsApp, open Updates and add it to My status.",
  statusHold: "Save your DP, then in WhatsApp, open Updates and add it to My status.",
  holdStatus(copied = true): string {
    return copied
      ? "Then open WhatsApp, go to Updates and add it to My status. Your caption is copied."
      : "Then open WhatsApp, go to Updates and add it to My status.";
  },

  captionLabel: "Your caption",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy. Press and hold the caption to copy it.",

  holdTitle: "Save your DP",
  holdHow(env: ShareEnv): string {
    return env.ios
      ? "Press and hold the picture, then choose Save to Photos."
      : "Press and hold the picture, then choose Download image.";
  },
  holdWaiting: "Getting your DP ready…",
  holdPlatform(platform: string, copied = true): string {
    return copied
      ? `Then open ${platform} and post it. Your caption is copied.`
      : `Then open ${platform} and post it.`;
  },
  holdFallback(env: ShareEnv): string {
    return `Nothing to save? Open this page in ${env.ios ? "Safari" : "Chrome"}, using the note at the top.`;
  },
  holdAlt: "Your Blockfest Africa 2026 DP",
  done: "Done",

  openInChrome: "Open in Chrome",
  copyLink: "Copy link",
  linkCopied(env: ShareEnv): string {
    return `Link copied. Paste it into ${env.ios ? "Safari" : "Chrome"}.`;
  },
  copyThisLink(link: string): string {
    return `Copy this link: ${link}`;
  },
} as const;
