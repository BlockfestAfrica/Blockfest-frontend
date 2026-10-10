/**
 * Sharing and saving the DP (app/getdp/lib/share.ts): which device a browser
 * is, what each control does there, and every sentence about it.
 *
 * The rule these defend above all: a website cannot attach a picture to an
 * X, LinkedIn or TikTok post, so nothing here may say or imply that the page
 * posts or uploads for anybody. Only the phone's share list carries the
 * picture, and the page never sends it anywhere itself.
 */
import { describe, expect, it } from "vitest";
import { shareText, xIntentUrl as dpXIntentUrl } from "@/app/getdp/lib/dp";
import {
  COPY,
  DESKTOP_ENV,
  INSTAGRAM_WEB,
  LINKEDIN_COMPOSE,
  PLATFORMS,
  TIKTOK_UPLOAD,
  appName,
  buttonsFor,
  chromeIntentUrl,
  detectEnv,
  deviceClass,
  inAppNotice,
  marksClass,
  moveHint,
  platformAction,
  copiesCaption,
  shareData,
  statusAction,
  whatsappUrl,
  xIntentUrl,
  type ShareEnv,
} from "@/app/getdp/lib/share";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  android:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.30.94 Android (34/14; 450dpi; 1080x2220; samsung; SM-A145F; a14; mt6769; en_GB; 640000000)",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 350.0.0.30.94 (iPhone15,3; iOS 18_5; en_GB; en; scale=3.00; 1290x2796; 640000000)",
  tiktokIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_39.0.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/NG BytedanceWebview/d8a21c6",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 trill_390004 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/trill app_version/39.0.4 ByteLocale/en",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.98;FBBV/650000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.98;]",
  linkedinIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp/9.30.1234",
  webview:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36",
};

const env = (
  ua: string,
  o: { coarse?: boolean; share?: boolean; jpeg?: boolean; text?: boolean; touch?: number } = {},
): ShareEnv =>
  detectEnv({
    ua,
    maxTouchPoints: o.touch ?? (o.coarse ? 5 : 0),
    coarse: o.coarse ?? false,
    canShareJpeg: o.jpeg ?? o.share ?? false,
    canSharePng: o.share ?? false,
    canShareJpegText: o.text ?? false,
  });

const IPHONE = env(UA.iphone, { coarse: true, share: true });
const IPHONE_NO_SHARE = env(UA.iphone, { coarse: true }); // Lockdown Mode
const ANDROID = env(UA.android, { coarse: true, share: true });
/** Chrome on Android today: the share list takes the caption beside the file. */
const ANDROID_TEXT = env(UA.android, { coarse: true, share: true, text: true });
const FIREFOX_ANDROID = env(UA.firefoxAndroid, { coarse: true });
const IG_ANDROID = env(UA.instagramAndroid, { coarse: true });
const IG_IOS = env(UA.instagramIos, { coarse: true, share: true });
const TIKTOK_IOS = env(UA.tiktokIos, { coarse: true, share: true });
/** Rare: an Android app's browser whose share list takes files. */
const IG_ANDROID_SHARE = env(UA.instagramAndroid, { coarse: true, share: true });
const DESKTOP = env(UA.macChrome);
const DESKTOP_SHARE = env(UA.macSafari, { share: true });

const CAPTION = shareText("attendee");
const FILE = "blockfest-2026-dp-ada-obi.png";

describe("which device this is", () => {
  it("knows an iPhone in Safari that shares files", () => {
    expect(IPHONE).toMatchObject({ ios: true, android: false, phone: true, inApp: false, fileShare: true, shareType: "image/jpeg" });
    expect(deviceClass(IPHONE)).toBe("sheet");
  });

  it("counts an iPad, which says Macintosh, as iOS by its touch points", () => {
    expect(env(UA.ipad, { coarse: true, share: true, touch: 5 }).ios).toBe(true);
    expect(env(UA.macSafari, { touch: 0 }).ios).toBe(false);
  });

  it("knows Chrome on Android", () => {
    expect(ANDROID).toMatchObject({ android: true, ios: false, inApp: false });
    expect(deviceClass(ANDROID)).toBe("sheet");
  });

  it("knows an Android in-app browser with no share list, and names the app", () => {
    expect(IG_ANDROID).toMatchObject({ inApp: true, app: "Instagram", fileShare: false, shareType: "image/png" });
    expect(deviceClass(IG_ANDROID)).toBe("hold");
    expect(env(UA.webview, { coarse: true })).toMatchObject({ inApp: true, app: null });
  });

  it("keeps the share list first in an iOS in-app browser that has one", () => {
    expect(IG_IOS).toMatchObject({ inApp: true, app: "Instagram", ios: true });
    expect(deviceClass(IG_IOS)).toBe("sheet");
  });

  it("names TikTok, Facebook and LinkedIn by every mark they leave", () => {
    expect(appName(UA.tiktokIos)).toBe("TikTok");
    expect(appName(UA.tiktokAndroid)).toBe("TikTok");
    expect(appName("Mozilla/5.0 BytedanceWebview/d8a21c6")).toBe("TikTok");
    expect(appName("Mozilla/5.0 musical_ly_39.0.0")).toBe("TikTok");
    expect(appName(UA.facebookIos)).toBe("Facebook");
    expect(appName(UA.facebookAndroid)).toBe("Facebook");
    for (const mark of ["FBIOS", "FB4A", "FBAN", "FB_IAB"]) {
      expect(appName(`Mozilla/5.0 [${mark}/1]`)).toBe("Facebook");
      expect(env(`Mozilla/5.0 [${mark}/1]`, { coarse: true }).inApp).toBe(true);
    }
    expect(appName(UA.linkedinIos)).toBe("LinkedIn");
    expect(env(UA.linkedinIos, { coarse: true }).app).toBe("LinkedIn");
  });

  it("treats every fine-pointer browser as a desktop", () => {
    for (const ua of [UA.macChrome, UA.macSafari, UA.winFirefox]) {
      expect(deviceClass(env(ua))).toBe("desktop");
      expect(deviceClass(env(ua, { share: true }))).toBe("desktop");
      expect(env(ua, { share: true }).shareType).toBe("image/png");
    }
  });

  it("knows a phone browser that cannot share files", () => {
    expect(deviceClass(FIREFOX_ANDROID)).toBe("download");
    expect(deviceClass(IPHONE_NO_SHARE)).toBe("download");
  });

  it("starts, before it has looked, as a desktop with nothing to share", () => {
    expect(deviceClass(DESKTOP_ENV)).toBe("desktop");
    expect(DESKTOP_ENV.fileShare).toBe(false);
  });
});

describe("the save and share buttons", () => {
  const ids = (e: ShareEnv) => buttonsFor(e).map((b) => `${b.id}:${b.intent}`);

  it("gives each kind of device its own, in order", () => {
    expect(ids(IPHONE)).toEqual(["share:primary", "photos:secondary", "download:quiet"]);
    expect(ids(IG_IOS)).toEqual(["share:primary", "photos:secondary"]);
    expect(ids(ANDROID)).toEqual(["share:primary", "download:secondary"]);
    expect(ids(IG_ANDROID_SHARE)).toEqual(["share:primary"]);
    expect(ids(IPHONE_NO_SHARE)).toEqual(["download:primary", "photos:secondary"]);
    expect(ids(FIREFOX_ANDROID)).toEqual(["download:primary"]);
    expect(ids(IG_ANDROID)).toEqual(["save:primary"]);
    expect(ids(DESKTOP)).toEqual(["download:primary"]);
    expect(ids(DESKTOP_SHARE)).toEqual(["download:primary", "more:quiet"]);
  });

  it("has exactly one primary everywhere, and never Download in an in-app browser", () => {
    for (const e of [IPHONE, IG_IOS, ANDROID, IPHONE_NO_SHARE, FIREFOX_ANDROID, IG_ANDROID, IG_ANDROID_SHARE, DESKTOP, DESKTOP_SHARE, TIKTOK_IOS]) {
      expect(buttonsFor(e).filter((b) => b.intent === "primary")).toHaveLength(1);
      if (e.inApp) expect(buttonsFor(e).map((b) => b.id)).not.toContain("download");
    }
  });
});

describe("the platform marks", () => {
  it("opens the share list for every platform on a phone that shares files", () => {
    for (const e of [IPHONE, ANDROID, IG_IOS]) {
      for (const p of PLATFORMS) {
        const a = platformAction(p, e, CAPTION, FILE);
        expect(a.kind).toBe("sheet");
        expect(a.href).toBeUndefined();
        expect(a.download).toBe(false);
      }
    }
    expect(platformAction("tiktok", IPHONE, CAPTION, FILE).tip).toMatch(/Choose Save Image/);
    expect(platformAction("tiktok", ANDROID, CAPTION, FILE).tip).toMatch(/Use Download PNG/);
  });

  it("links to each site on a desktop, and saves the DP too", () => {
    const href = (p: (typeof PLATFORMS)[number]) => platformAction(p, DESKTOP, CAPTION, FILE).href;
    expect(href("x")).toBe(xIntentUrl(CAPTION));
    expect(href("x")).toMatch(/^https:\/\/x\.com\/intent\/tweet\?text=/);
    expect(href("linkedin")).toBe("https://www.linkedin.com/feed/");
    expect(href("whatsapp")).toBe(`https://wa.me/?text=${encodeURIComponent(CAPTION)}`);
    expect(href("instagram")).toBe("https://www.instagram.com/");
    expect(href("tiktok")).toBe(TIKTOK_UPLOAD);
    for (const p of PLATFORMS) {
      expect(platformAction(p, DESKTOP, CAPTION, FILE)).toMatchObject({ kind: "link", download: true });
    }
    expect(platformAction("x", DESKTOP, CAPTION, FILE).tip).toContain(`(${FILE})`);
    expect(LINKEDIN_COMPOSE).toBe("https://www.linkedin.com/feed/");
    expect(INSTAGRAM_WEB).toBe("https://www.instagram.com/");
    expect(whatsappUrl("a b")).toBe("https://wa.me/?text=a%20b");
  });

  it("links where a phone can post from the web, and only saves where it cannot", () => {
    for (const p of ["x", "linkedin", "whatsapp"] as const) {
      expect(platformAction(p, FIREFOX_ANDROID, CAPTION, FILE)).toMatchObject({ kind: "link", download: true });
    }
    for (const p of ["tiktok", "instagram"] as const) {
      const a = platformAction(p, FIREFOX_ANDROID, CAPTION, FILE);
      expect(a).toMatchObject({ kind: "save", download: true });
      expect(a.href).toBeUndefined();
    }
  });

  it("sends an iPhone that cannot share files to the press-and-hold picture, since its downloads go to Files", () => {
    expect(deviceClass(IPHONE_NO_SHARE)).toBe("download");
    expect(marksClass(IPHONE_NO_SHARE)).toBe("hold");
    for (const p of PLATFORMS) {
      const a = platformAction(p, IPHONE_NO_SHARE, CAPTION, FILE);
      expect(a).toMatchObject({ kind: "hold", download: false });
      expect(a.href).toBeUndefined();
      expect(a.tip).not.toMatch(/choose your DP|you just saved/);
    }
    // Everywhere else the marks follow the device's class.
    for (const e of [IPHONE, ANDROID, FIREFOX_ANDROID, IG_ANDROID, IG_IOS, DESKTOP, DESKTOP_SHARE]) {
      expect(marksClass(e)).toBe(deviceClass(e));
    }
  });

  it("never leaves an in-app browser: every mark goes to the press-and-hold picture", () => {
    for (const p of PLATFORMS) {
      expect(platformAction(p, IG_ANDROID, CAPTION, FILE)).toMatchObject({ kind: "hold", download: false });
      expect(platformAction(p, IG_ANDROID, CAPTION, FILE).href).toBeUndefined();
    }
  });

  it("never puts the picture in a link, and never claims to post or upload for anybody", () => {
    const everyEnv = [
      IPHONE,
      ANDROID,
      ANDROID_TEXT,
      FIREFOX_ANDROID,
      IPHONE_NO_SHARE,
      IG_ANDROID,
      IG_ANDROID_SHARE,
      IG_IOS,
      TIKTOK_IOS,
      DESKTOP,
      DESKTOP_SHARE,
    ];
    for (const e of everyEnv) {
      for (const p of PLATFORMS) {
        const a = platformAction(p, e, CAPTION, FILE);
        if (a.href) {
          expect(a.href).not.toMatch(/blob:|data:/);
          expect(a.href).not.toContain(FILE);
          expect(a.href).not.toContain("blockfest-2026-dp");
        }
        expect(a.tip).not.toMatch(/automatically|upload(ed)? (it )?for you|we('ll| will)? (post|upload|share)/i);
      }
    }
    // Every sentence the page says about saving and sharing, on any device.
    const said: string[] = [];
    for (const [, v] of Object.entries(COPY)) {
      if (typeof v === "string") said.push(v);
    }
    for (const e of everyEnv) {
      for (const c of ["sheet", "download", "hold", "desktop"] as const) {
        said.push(COPY.marksDo(c), COPY.marksDo(c, true), COPY.ready(c));
      }
      said.push(COPY.profile(e), COPY.downloading(e, FILE), COPY.holdHow(e), COPY.holdFallback(e));
      const s = statusAction(e);
      if (s) said.push(s.how);
      const n = inAppNotice(e);
      if (n) said.push(n.title, n.body);
    }
    said.push(COPY.holdStatus(), COPY.holdStatus(false));
    for (const s of said) {
      expect(s).not.toMatch(/automatically|upload(ed)? (it )?for you|we('ll| will)? (post|upload|share)|posts? it for you/i);
    }
  });

  it("offers WhatsApp Status on a phone only, through the share list where it takes the file", () => {
    for (const e of [IPHONE, ANDROID, IG_IOS, TIKTOK_IOS]) {
      expect(statusAction(e)).toEqual({
        kind: "sheet",
        how: "Opens your share list with your DP: pick WhatsApp, then My status.",
      });
    }
    expect(statusAction(FIREFOX_ANDROID)).toEqual({
      kind: "save",
      how: "Saves your DP and copies your caption. Then in WhatsApp, open Updates and add it to My status.",
    });
    // An iPhone's download goes to Files, which WhatsApp's picker never shows: press and hold instead.
    for (const e of [IPHONE_NO_SHARE, IG_ANDROID]) {
      expect(statusAction(e)).toEqual({
        kind: "hold",
        how: "Save your DP, then in WhatsApp, open Updates and add it to My status.",
      });
    }
    // Status is posted from the phone app; a desktop has nowhere to send it.
    expect(statusAction(DESKTOP)).toBeNull();
    expect(statusAction(DESKTOP_SHARE)).toBeNull();
  });

  it("knows when the caption goes with the picture: Android's share list taking text beside the file", () => {
    expect(ANDROID_TEXT.captionTravels).toBe(true);
    // Not where the list takes the file alone, nor on an Apple device, where text is never sent.
    expect(ANDROID.captionTravels).toBe(false);
    expect(env(UA.iphone, { coarse: true, share: true, text: true }).captionTravels).toBe(false);
    expect(env(UA.macSafari, { share: true, text: true }).captionTravels).toBe(false);
    expect(env(UA.android, { coarse: true, share: true, jpeg: false, text: true }).captionTravels).toBe(false);
    expect(DESKTOP_ENV.captionTravels).toBe(false);
  });

  it("copies the caption only where it does not go with the picture", () => {
    for (const t of ["x", "whatsapp", "status"] as const) {
      expect(copiesCaption(t, ANDROID_TEXT)).toBe(false);
      expect(copiesCaption(t, IPHONE)).toBe(true);
      expect(copiesCaption(t, ANDROID)).toBe(true);
    }
    // Instagram, TikTok and LinkedIn leave the caption out, and the big Share button's app is unknown.
    for (const t of ["instagram", "tiktok", "linkedin", "share"] as const) expect(copiesCaption(t, ANDROID_TEXT)).toBe(true);
  });

  it("tells an Android phone to pick the app, and to paste only where the caption was copied", () => {
    expect(platformAction("x", ANDROID_TEXT, CAPTION, FILE).tip).toBe(
      "Pick X in the list. If your caption is missing, use Copy below and paste it.",
    );
    expect(platformAction("whatsapp", ANDROID_TEXT, CAPTION, FILE).tip).toBe(
      "Pick WhatsApp in the list, then a chat or My status.",
    );
    expect(platformAction("instagram", ANDROID_TEXT, CAPTION, FILE).tip).toMatch(/paste your caption/);
    expect(platformAction("linkedin", ANDROID_TEXT, CAPTION, FILE).tip).toMatch(/paste your caption/);
    expect(platformAction("x", IPHONE, CAPTION, FILE).tip).toBe("Pick X. If your caption isn't in the post, paste it.");
    expect(COPY.marksDo("sheet", true)).toBe("Each opens your phone's share list with your DP: pick the app there.");
    // The line under the marks no longer says to paste, so every tap that copies says it in its tip.
    for (const p of PLATFORMS) {
      if (copiesCaption(p, ANDROID_TEXT)) expect(platformAction(p, ANDROID_TEXT, CAPTION, FILE).tip).toMatch(/paste your caption/);
    }
    expect(platformAction("tiktok", ANDROID_TEXT, CAPTION, FILE).tip).toBe(
      "Pick TikTok, then paste your caption. Not in the list? Use Download PNG, then post it from TikTok with +.",
    );
  });

  it("keeps one definition of the X link", () => {
    expect(xIntentUrl).toBe(dpXIntentUrl);
  });
});

describe("what goes to the share list", () => {
  const file = new File(["x"], "blockfest-2026-dp-ada-obi.jpg", { type: "image/jpeg" });

  it("hands an Apple device the file alone: no text, title or link", () => {
    const data = shareData(file, IPHONE, CAPTION, () => true);
    expect(data).toEqual({ files: [file] });
    expect(Object.keys(data)).toEqual(["files"]);
    expect(shareData(file, IG_IOS, CAPTION, () => true)).toEqual({ files: [file] });
  });

  it("adds the caption on Android when the browser takes text with a file", () => {
    expect(shareData(file, ANDROID, CAPTION, () => true)).toEqual({ files: [file], text: CAPTION });
  });

  it("sends the file alone on Android when the browser will not take both", () => {
    expect(shareData(file, ANDROID, CAPTION, (d) => !("text" in d))).toEqual({ files: [file] });
    expect(shareData(file, ANDROID, CAPTION, () => {
      throw new TypeError("no");
    })).toEqual({ files: [file] });
    expect(shareData(file, ANDROID, CAPTION)).toEqual({ files: [file] });
  });
});

describe("leaving an in-app browser", () => {
  it("opens this page in Chrome from Android", () => {
    expect(chromeIntentUrl("https://blockfestafrica.com/getdp")).toBe(
      "intent://blockfestafrica.com/getdp#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fblockfestafrica.com%2Fgetdp;end",
    );
  });

  it("tells Instagram on Android to open Chrome from its menu", () => {
    const n = inAppNotice(IG_ANDROID);
    expect(n).toEqual({
      title: "Open this page in Chrome",
      body: "Instagram's browser can't save your DP. Tap ⋮ at the top, then Open in Chrome.",
      chrome: true,
    });
    expect(inAppNotice(env(UA.webview, { coarse: true }))?.body).toBe(
      "This app's browser can't save your DP. Tap ⋮ at the top, then Open in browser.",
    );
  });

  it("tells TikTok on iOS to paste the link into Safari, since it has no such menu item", () => {
    expect(inAppNotice(TIKTOK_IOS)).toEqual({
      title: "Saving may not work in TikTok's browser",
      body: "If it doesn't, copy the link and paste it into Safari.",
      chrome: false,
    });
    expect(inAppNotice(env(UA.tiktokIos, { coarse: true }))?.body).toBe("Copy the link, then paste it into Safari.");
    expect(inAppNotice(IG_IOS)?.body).toBe("If it doesn't, tap ••• at the top, then Open in browser.");
    expect(inAppNotice(env(UA.instagramIos, { coarse: true }))).toEqual({
      title: "Open this page in Safari",
      body: "Instagram's browser can't save your DP. Tap ••• at the top, then Open in browser.",
      chrome: false,
    });
  });

  it("still offers Chrome from an Android app's browser that can share", () => {
    expect(inAppNotice(IG_ANDROID_SHARE)).toEqual({
      title: "Saving may not work in Instagram's browser",
      body: "If it doesn't, tap ⋮ at the top, then Open in Chrome.",
      chrome: true,
    });
  });

  it("says nothing in a normal browser", () => {
    for (const e of [IPHONE, ANDROID, FIREFOX_ANDROID, DESKTOP, DESKTOP_ENV]) expect(inAppNotice(e)).toBeNull();
  });
});

describe("the words", () => {
  it("says where a download goes on each device", () => {
    expect(COPY.downloading(IPHONE, FILE)).toBe(
      `Downloading ${FILE}. On iPhone it goes to Files, in Downloads. For Photos, use Save to Photos.`,
    );
    expect(COPY.downloading(ANDROID, FILE)).toBe(`Downloading ${FILE}. Look for it in Downloads.`);
    expect(COPY.downloading(DESKTOP, FILE)).toBe(`Downloading ${FILE}.`);
  });

  it("offers pinching on a touch screen and the arrow keys with a mouse", () => {
    const both = { maxX: 0.2, maxY: 0.3 };
    expect(moveHint(both, true)).toBe("Drag your photo to move it in its frame. Pinch to zoom.");
    expect(moveHint(both, false)).toBe("Drag your photo to move it in its frame. On a keyboard, the arrow keys move it.");
    expect(moveHint({ maxX: 0, maxY: 0 }, false)).toMatch(/^Your photo fills its frame\. Zoom in to move it\./);
    expect(moveHint({ maxX: 0, maxY: 0.4 }, true)).toMatch(/^Drag your photo up or down to move it\./);
    expect(moveHint({ maxX: 0.4, maxY: 0 }, true)).toMatch(/^Drag your photo sideways to move it\./);
  });

  it("says what the marks do before any is tapped, never that the caption is already copied", () => {
    for (const c of ["sheet", "download", "hold", "desktop"] as const) {
      expect(COPY.marksDo(c)).toMatch(/copies your caption/);
      expect(COPY.marksDo(c)).not.toMatch(/is copied/);
      expect(COPY.marksDo(c, true)).not.toMatch(/is copied/);
    }
    expect(COPY.holdPlatform("LinkedIn")).toBe("Then open LinkedIn and post it. Your caption is copied.");
    expect(COPY.holdPlatform("LinkedIn", false)).toBe("Then open LinkedIn and post it.");
    expect(COPY.holdStatus()).toBe(
      "Then open WhatsApp, go to Updates and add it to My status. Your caption is copied.",
    );
    expect(COPY.holdStatus(false)).toBe("Then open WhatsApp, go to Updates and add it to My status.");
    for (const e of [IPHONE, FIREFOX_ANDROID, IG_ANDROID]) expect(statusAction(e)!.how).not.toMatch(/is copied/);
  });

  it("says ready in the words of what this device does next", () => {
    expect(COPY.ready("sheet")).toBe("Ready to share");
    expect(COPY.ready("hold")).toBe("Ready to save");
    expect(COPY.ready("desktop")).toBe("Ready to download");
    expect(COPY.ready("download")).toBe("Ready to download");
  });
});
