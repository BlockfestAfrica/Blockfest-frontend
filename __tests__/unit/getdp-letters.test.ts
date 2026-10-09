/**
 * How a name is spelt in the DP's display face (app/getdp/lib/letters.ts):
 * nothing is ever drawn in a fallback font. A letter the face lacks is set
 * as its plain stand-in or left out and reported; a mark it lacks is
 * borrowed from a capital that has it, or left off and reported.
 *
 * The face is a stand-in list of what Bebas Neue's latin and latin-ext files
 * hold: plain and accented capitals, but no dot-below letters, no Ǒ, and
 * none of the hooked or African capitals (Ɓ Ɗ Ɖ Ɣ Ǝ Ƒ).
 */
import { describe, expect, it } from "vitest";
import {
  clusters,
  drawnLetters,
  letterNotes,
  markSource,
  type HasGlyph,
} from "@/app/getdp/lib/letters";

const FACE = new Set([
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .'’‘-",
  ..."ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ",
  ..."ĀĂĄĆČĎĒĔĖĘĚĞĪĬĮİŃŇŌŎŐŘŚŞŠŤŪŬŮŰŻŽ",
]);
const bebas: HasGlyph = (ch) => FACE.has(ch);

describe("spelling a name in the display face's own letters", () => {
  it("sets Ewe and Pan-Nigerian capitals the face lacks as their plain letters, and says so", () => {
    expect(drawnLetters("ƉOSSOU KƎLLA ƔEVU ƑO", bebas)).toBe("DOSSOU KELLA GEVU FO");
    expect(letterNotes("Ɖossou Kǝlla Ɣevu", bebas)).toEqual([
      { letter: "Ɖ", drawn: "D" },
      { letter: "Ǝ", drawn: "E" },
      { letter: "Ɣ", drawn: "G" },
    ]);
    // The Hausa hooked letters, as before.
    expect(letterNotes("Ɗanjuma Ƙabiru", bebas)).toEqual([
      { letter: "Ɗ", drawn: "D" },
      { letter: "Ƙ", drawn: "K" },
    ]);
  });

  it("leaves out a letter it has no form or stand-in for, and reports it as undrawable", () => {
    // Ƣ (U+01A2): Latin, so the name is accepted, but nothing can stand in.
    expect(drawnLetters("AƢB", bebas)).toBe("AB");
    expect(clusters("AƢB", bebas)[1]).toMatchObject({ glyph: "", above: [], dotBelow: false });
    expect(letterNotes("Aƣb", bebas)).toEqual([{ letter: "Ƣ", drawn: null }]);
  });

  it("sets the vertical line below some Yoruba keyboards type as the same dot as Ẹ", () => {
    const [typed] = clusters("E\u0329BUN", bebas);
    const [precomposed] = clusters("ẸBUN", bebas);
    expect(typed).toMatchObject({ glyph: "E", dotBelow: true, above: [], dropped: [] });
    expect(precomposed).toMatchObject({ glyph: "E", dotBelow: true, above: [], dropped: [] });
    expect(letterNotes("E\u0329bun", bebas)).toEqual([]);
  });

  it("borrows a caron the face lacks on O from a capital that has one", () => {
    expect(markSource("\u030C", bebas)).toEqual(["Ě", "E"]);
    expect(clusters("ǑLA", bebas)[0]).toMatchObject({ glyph: "O", above: ["\u030C"], dropped: [] });
    expect(letterNotes("Ǒla", bebas)).toEqual([]);
    // Where the face has it, the precomposed letter is used as it is.
    expect(clusters("ŇA", bebas)[0]).toMatchObject({ glyph: "Ň", above: [] });
  });

  it("recomposes tone marks the face has and sets the dot below apart", () => {
    expect(clusters("Ọ\u0301LÁ", bebas)).toMatchObject([
      { glyph: "Ó", dotBelow: true, above: [] },
      { glyph: "L", dotBelow: false, above: [] },
      { glyph: "Á", dotBelow: false, above: [] },
    ]);
    expect(letterNotes("Ọláolúwaṣeun Adébáyọ\u0300-Ògúnṣọlá", bebas)).toEqual([]);
  });

  it("never drops a mark without saying so", () => {
    // A cedilla on D: no precomposed Ḑ in the face and nowhere to borrow a
    // mark below from, so it is left off and reported.
    expect(clusters("ḐA", bebas)[0]).toMatchObject({ glyph: "D", above: [], dropped: ["\u0327"] });
    expect(letterNotes("Ḑa", bebas)).toEqual([{ letter: "Ḑ", drawn: "D" }]);
    // A face with no caron anywhere: the caron is reported, not lost quietly.
    const bare: HasGlyph = (ch) => /^[A-Z ]$/.test(ch);
    expect(markSource("\u030C", bare)).toBeNull();
    expect(letterNotes("Ǒla", bare)).toEqual([{ letter: "Ǒ", drawn: "O" }]);
    // The dot above always has Bebas's own full stop to fall back on.
    expect(clusters("Z\u0307", bare)[0]).toMatchObject({ glyph: "Z", above: ["\u0307"], dropped: [] });
  });
});
