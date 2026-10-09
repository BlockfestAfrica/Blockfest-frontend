/**
 * The DP's two faces, loaded by the page itself.
 *
 * next/font writes Bebas Neue and Gotham as CSS @font-face rules. The page
 * reads where those rules put the files and loads each file as its own
 * FontFace, under a family name only the DP draws in. Two things the CSS
 * faces cannot do, and this can:
 *
 * - Never trip on a fallback face. next/font gives each face a "… Fallback"
 *   face whose only source is local("Arial"); Android has no Arial, so that
 *   face fails, and any load that names its family fails with it. The DP's
 *   own families have no fallback face at all.
 * - Try again for real. A CSS face whose file failed stays failed for the
 *   life of the page, and one whose request stalled waits on that request
 *   for ever. Here a try that failed or ran out of time is forgotten, and
 *   the next try asks for the file afresh (a new URL, so it cannot join a
 *   request that stalled).
 *
 * The files are fonts the site already serves, asked for as fonts, as the CSS
 * would: nothing is sent anywhere (see __tests__/unit/privacy.test.ts).
 *
 * The rule stays: nothing is drawn until both faces have loaded.
 */
import { FontLoadError, errorDetail } from "./errors";
import { DP_FONTS } from "./fonts";

/** The families the DP draws in. Only the faces loaded here carry them. */
export const DP_FAMILY = {
  display: "Blockfest DP Display",
  text: "Blockfest DP Text",
} as const;

/**
 * How long one try may take. On a stalled connection the requests never
 * settle, and the page would say "Preparing" for ever; past this it says the
 * lettering did not load and offers Try again, keeping everything typed.
 */
export const FONT_TIMEOUT_MS = 12_000;

/** CSSRule.FONT_FACE_RULE, without needing the CSSFontFaceRule class. */
const FONT_FACE_RULE = 5;

/** The first family of a CSS font-family stack, without its quotes. */
export function primaryFamily(stack: string): string {
  return stack.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

export interface FaceSource {
  /** The DP family it is loaded as. */
  family: string;
  url: string;
  descriptors: FontFaceDescriptors;
}

interface RuleLike {
  type: number;
  style?: { getPropertyValue(name: string): string };
}

/**
 * Where next/font put the files of Bebas Neue and Gotham, from the page's
 * own @font-face rules. A "… Fallback" face has another family name and a
 * local() source only, so it is never among them. Throws when either face
 * has no file in the page's styles.
 */
export function faceSources(
  sheets: ArrayLike<{ cssRules: ArrayLike<RuleLike> }> = document.styleSheets as unknown as ArrayLike<{
    cssRules: ArrayLike<RuleLike>;
  }>,
  base: string = document.baseURI,
): FaceSource[] {
  const wanted = new Map<string, string>([
    [primaryFamily(DP_FONTS.display), DP_FAMILY.display],
    [primaryFamily(DP_FONTS.text), DP_FAMILY.text],
  ]);
  const found: FaceSource[] = [];
  for (const sheet of Array.from(sheets)) {
    let rules: ArrayLike<RuleLike>;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // A stylesheet from another origin cannot be read; next/font's never is.
    }
    for (const rule of Array.from(rules)) {
      if (rule.type !== FONT_FACE_RULE || !rule.style) continue;
      const style = rule.style;
      const family = wanted.get(primaryFamily(style.getPropertyValue("font-family")));
      const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(style.getPropertyValue("src"))?.[1];
      if (!family || !url) continue;
      const descriptors: FontFaceDescriptors = {
        style: style.getPropertyValue("font-style").trim() || "normal",
        weight: style.getPropertyValue("font-weight").trim() || "400",
      };
      const range = style.getPropertyValue("unicode-range").trim();
      if (range) descriptors.unicodeRange = range;
      found.push({ family, url: new URL(url, base).href, descriptors });
    }
  }
  for (const [css, family] of wanted) {
    if (!found.some((s) => s.family === family)) {
      throw new FontLoadError(`DP font not in the page's styles: ${css}`);
    }
  }
  return found;
}

/** Each file that has loaded, by URL: a later try does not ask for it again. */
const loaded = new Map<string, FontFace>();
/** The try under way, shared by every draw that asks meanwhile. */
let current: Promise<void> | null = null;
/** How many tries have started: a retry's URL carries it. */
let tries = 0;

async function loadSource(source: FaceSource, attempt: number): Promise<void> {
  if (loaded.has(source.url)) return;
  // A retry asks for the file under a new URL, so it can never wait on the
  // request that stalled (a face on the same URL joins it).
  const url = attempt === 0 ? source.url : `${source.url}${source.url.includes("?") ? "&" : "?"}dp=${attempt}`;
  const face = await new FontFace(source.family, `url("${url}")`, source.descriptors).load();
  // A file that came after its try gave up still counts, but only once.
  if (loaded.has(source.url)) return;
  document.fonts.add(face);
  loaded.set(source.url, face);
}

/**
 * Both faces, loaded once. Resolves when every file of both has loaded;
 * rejects with a FontLoadError when one fails or the try runs past
 * FONT_TIMEOUT_MS, and the next call tries again from fresh.
 */
export function loadDpFaces(): Promise<void> {
  if (current) return current;
  const attempt = tries++;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = Promise.race([
    Promise.resolve().then(() => Promise.all(faceSources().map((s) => loadSource(s, attempt)))),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new FontLoadError("DP fonts timed out")), FONT_TIMEOUT_MS);
    }),
  ]).then(
    () => clearTimeout(timer),
    (e: unknown) => {
      clearTimeout(timer);
      if (current === settled) current = null;
      throw e instanceof FontLoadError ? e : new FontLoadError(`DP fonts did not load (${errorDetail(e)})`);
    },
  );
  current = settled;
  return settled;
}

/** For tests: forget every face and try, as a fresh page would. */
export function resetDpFaces(): void {
  loaded.clear();
  current = null;
  tries = 0;
}
