/**
 * The DP's looks (app/getdp/lib/looks.ts): the design people were already
 * posting stays first and the default; "Sunset" (the design team's own
 * sample) and "Colour fields" follow; every role stays readable on each.
 */
import { describe, expect, it } from "vitest";
import { DP_ROLES } from "@/app/getdp/lib/dp";
import { DP_STYLES, EXTRA_TONES, LOOKS, STYLE_LABEL, STYLE_MARK, SUN } from "@/app/getdp/lib/looks";

/** WCAG relative luminance and contrast, for #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the looks", () => {
  it("offers the design people already post first, then Sunset and Colour fields", () => {
    expect(DP_STYLES).toEqual(["routes", "sunset", "fields"]);
    expect(DP_STYLES.map((s) => STYLE_LABEL[s])).toEqual(["Trade routes", "Sunset", "Colour fields"]);
    expect(Object.keys(LOOKS)).toEqual(["fields"]);
  });

  it("gives each design its own version of the mark: black lettering only on white, all white on the orange", () => {
    expect(STYLE_MARK).toEqual({ routes: "onDark", sunset: "white", fields: "onLight" });
    expect(LOOKS.fields.mark).toBe("onLight");
    expect(EXTRA_TONES).toEqual(["onLight", "white"]);
  });

  it("keeps Sunset's black role line readable on its whole gradient, as the team's sample sets it", () => {
    for (const ground of [SUN.top, SUN.bottom]) expect(contrast(SUN.role, ground), ground).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every role's pill readable: at least 3:1, the large-text floor", () => {
    for (const [style, look] of Object.entries(LOOKS)) {
      for (const role of DP_ROLES) {
        const { fill, text } = look.pill(role);
        expect(contrast(fill, text), `${style} ${role}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
