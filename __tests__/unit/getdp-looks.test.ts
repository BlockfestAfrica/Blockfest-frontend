/**
 * The DP's looks (app/getdp/lib/looks.ts): the design people were already
 * posting stays first and the default; the two the owner picked from the
 * 2026 brand kit follow; every role's pill stays readable on each.
 */
import { describe, expect, it } from "vitest";
import { DP_ROLES } from "@/app/getdp/lib/dp";
import { DP_STYLES, LOOKS, STYLE_LABEL } from "@/app/getdp/lib/looks";

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
  it("offers the design people already post first, then Wave crown and Colour fields", () => {
    expect(DP_STYLES).toEqual(["routes", "scallop", "fields"]);
    expect(DP_STYLES.map((s) => STYLE_LABEL[s])).toEqual(["Trade routes", "Wave crown", "Colour fields"]);
    expect(Object.keys(LOOKS).sort()).toEqual(["fields", "scallop"]);
  });

  it("puts black lettering only on the white ground", () => {
    expect(LOOKS.scallop.mark).toBe("onDark");
    expect(LOOKS.fields.mark).toBe("onLight");
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
