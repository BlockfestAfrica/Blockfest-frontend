import { describe, expect, it } from "vitest";
import { canonicalHandle } from "@/lib/campaign-registration";

/*
 * The add-a-platform field and the registration field must agree about what
 * a username looks like.
 *
 * They did not. Registration runs canonicalHandle, which pulls the username
 * out of a pasted profile URL, because that is what people actually do: open
 * the profile, copy the address bar, paste. The add field started out as a
 * plain max(41) string, so the same paste that registered a creator on day
 * one was refused when they came back to add a second platform.
 */

describe("what both handle fields accept", () => {
  it("takes a pasted profile URL, which is how people copy a handle", () => {
    expect(canonicalHandle("https://instagram.com/amara.obi")).toBe("amara.obi");
    expect(canonicalHandle("https://www.tiktok.com/@amara.obi")).toBe("amara.obi");
    expect(canonicalHandle("https://x.com/amaraobi")).toBe("amaraobi");
  });

  it("takes the @ people type", () => {
    expect(canonicalHandle("@amara.obi")).toBe("amara.obi");
  });

  it("leaves a bare username alone", () => {
    expect(canonicalHandle("amara.obi")).toBe("amara.obi");
  });

  it("produces something the engine's own regex accepts", () => {
    // add_social_handle enforces ^[a-z0-9._]{1,40}$. A field that accepts
    // input the function then refuses is a form that lies.
    const engine = /^[a-z0-9._]{1,40}$/;
    for (const input of [
      "https://instagram.com/amara.obi",
      "@amara.obi",
      "amara.obi",
      "https://www.tiktok.com/@amara.obi",
    ]) {
      expect(engine.test(canonicalHandle(input)), input).toBe(true);
    }
  });
});
