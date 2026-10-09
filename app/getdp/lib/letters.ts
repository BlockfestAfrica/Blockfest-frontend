/**
 * How a name is spelt out in the display face's own letters.
 *
 * Bebas Neue has no dot-below letters (Yoruba Ẹ Ọ Ṣ, Igbo Ị Ọ Ụ), and a
 * missing glyph would fall back to another font. So a name is split into
 * clusters: each base letter with its marks recomposed where Bebas has that
 * letter (Á À É È Í Ì Ó Ò Ú Ù and the rest of latin and latin-ext), any dot
 * below set separately with Bebas's own full stop, and any mark Bebas lacks
 * on that letter (Ǒ, say) borrowed from the same mark on a capital Bebas has
 * (Ě) and set over the base letter. A letter Bebas has no form of at all
 * (the hooked Ɓ Ɗ Ƙ Ƴ, Ewe Ɖ Ɣ) is set as its nearest plain letter. A letter
 * with no plain stand-in is left out of the picture, and the page says so
 * and holds back the download: every stroke in the name is Bebas.
 *
 * Pure: `has` says whether the face has a glyph for one character. draw.ts
 * measures that in the browser; a test passes a list.
 */

export type HasGlyph = (ch: string) => boolean;

export const COMBINING = /[\u0300-\u036F]/;

/**
 * The dot below (U+0323), and the vertical line below (U+0329) that some
 * Yoruba keyboards type in its place: both are set as a full stop under the
 * letter.
 */
export const isDotBelow = (mark: string) => mark === "\u0323" || mark === "\u0329";

export const DOT_ABOVE = "\u0307";

/**
 * Where a mark the face lacks on a letter is borrowed from: capitals that
 * carry it, each with its plain base, in order of preference. The first one
 * the face has is used.
 */
export const MARK_SOURCES: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  "\u0300": [["Ò", "O"], ["À", "A"], ["È", "E"]], // grave
  "\u0301": [["Ó", "O"], ["Á", "A"], ["É", "E"]], // acute
  "\u0302": [["Ô", "O"], ["Â", "A"], ["Ê", "E"]], // circumflex
  "\u0303": [["Õ", "O"], ["Ã", "A"], ["Ñ", "N"]], // tilde
  "\u0304": [["Ō", "O"], ["Ā", "A"], ["Ē", "E"]], // macron
  "\u0306": [["Ŏ", "O"], ["Ă", "A"], ["Ĕ", "E"]], // breve
  "\u0307": [["Ż", "Z"], ["Ė", "E"]], // dot above
  "\u0308": [["Ö", "O"], ["Ä", "A"], ["Ë", "E"]], // diaeresis
  "\u030A": [["Å", "A"], ["Ů", "U"]], // ring above
  "\u030B": [["Ő", "O"], ["Ű", "U"]], // double acute
  "\u030C": [["Ǒ", "O"], ["Ě", "E"], ["Č", "C"], ["Š", "S"]], // caron
};

/** Capitals with no decomposition, set as the nearest plain capital. */
export const PLAIN_CAPITAL: Readonly<Record<string, string>> = {
  Ɓ: "B",
  Ɗ: "D",
  Ƙ: "K",
  Ƴ: "Y",
  Ŋ: "N",
  Ɛ: "E",
  Ɔ: "O",
  Ə: "E",
  Ǝ: "E",
  Ʋ: "V",
  Ŧ: "T",
  Đ: "D",
  Ɖ: "D",
  Ħ: "H",
  Ł: "L",
  Ƒ: "F",
  Ɣ: "G",
  Ʃ: "S",
  Ʒ: "Z",
  Ɲ: "N",
  Ƥ: "P",
  Ƭ: "T",
  Ɨ: "I",
  Ʉ: "U",
  Ʌ: "V",
};

/** The capital (and its base) a mark is borrowed from, or null if none is drawable. */
export function markSource(mark: string, has: HasGlyph): readonly [string, string] | null {
  return MARK_SOURCES[mark]?.find(([src]) => has(src)) ?? null;
}

/** Whether a mark over a letter can be drawn: borrowed, or the dot above's full stop. */
const drawableMark = (mark: string, has: HasGlyph) =>
  mark === DOT_ABOVE || markSource(mark, has) !== null;

export interface Cluster {
  /** The letter as typed, marks and all (NFC). */
  typed: string;
  /** What the face draws in the line: a letter it has, or "" for none. */
  glyph: string;
  dotBelow: boolean;
  /** Marks above the face lacks on this letter, set over it bottom-up. */
  above: string[];
  /** Marks on this letter that cannot be drawn at all, left off. */
  dropped: string[];
  /** The base letter is a plain stand-in for one the face lacks (Ɖ as D). */
  plain: boolean;
}

export function clusters(line: string, has: HasGlyph): Cluster[] {
  const raw: { base: string; marks: string[] }[] = [];
  for (const ch of line.normalize("NFD")) {
    if (COMBINING.test(ch) && raw.length) raw[raw.length - 1].marks.push(ch);
    else raw.push({ base: ch, marks: [] });
  }
  return raw.map(({ base, marks }) => {
    const typed = (base + marks.join("")).normalize("NFC");
    const dotBelow = marks.some(isDotBelow);
    const rest = marks.filter((m) => !isDotBelow(m));
    // Recompose as many marks as the face has a precomposed letter for.
    for (let n = rest.length; n > 0; n--) {
      const g = (base + rest.slice(0, n).join("")).normalize("NFC");
      if ([...g].length === 1 && has(g)) {
        const left = rest.slice(n);
        return {
          typed,
          glyph: g,
          dotBelow,
          above: left.filter((m) => drawableMark(m, has)),
          dropped: left.filter((m) => !drawableMark(m, has)),
          plain: false,
        };
      }
    }
    const plain = !has(base) && !!PLAIN_CAPITAL[base];
    const glyph = has(base) ? base : (PLAIN_CAPITAL[base] ?? "");
    return {
      typed,
      glyph,
      dotBelow: glyph ? dotBelow : false,
      above: glyph ? rest.filter((m) => drawableMark(m, has)) : [],
      dropped: glyph ? rest.filter((m) => !drawableMark(m, has)) : [],
      plain,
    };
  });
}

/** What the face actually draws for a line: base letters, no loose marks. */
export const drawnLetters = (line: string, has: HasGlyph) =>
  clusters(line, has)
    .map((c) => c.glyph)
    .join("");

export interface LetterNote {
  /** The letter as typed (uppercase, as the picture sets it). */
  letter: string;
  /** What is drawn in its place, or null when the face cannot draw it at all. */
  drawn: string | null;
}

/**
 * Every letter of a name the picture cannot set as typed, each once, with
 * what it draws instead: a plain stand-in (Ɖ as D), the letter without a
 * mark it cannot draw, or null for a letter it cannot draw at all, which
 * the page treats as a problem with the name. Empty for nearly every name.
 */
export function letterNotes(name: string, has: HasGlyph): LetterNote[] {
  const seen = new Set<string>();
  const out: LetterNote[] = [];
  for (const c of clusters(name.toUpperCase().normalize("NFC"), has)) {
    if (c.typed === " " || seen.has(c.typed)) continue;
    seen.add(c.typed);
    if (!c.glyph) out.push({ letter: c.typed, drawn: null });
    else if (c.plain || c.dropped.length) {
      out.push({ letter: c.typed, drawn: (c.glyph + c.above.join("")).normalize("NFC") });
    }
  }
  return out;
}
