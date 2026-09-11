/**
 * The pre-launch gate override.
 *
 * This flag lifts the opening-date check on a live site, so the only property
 * worth testing is that it stays shut unless it is turned on deliberately.
 * Everything vague has to read as closed: unset, empty, "false", "1", "TRUE".
 * A loose comparison here would open registration on any deploy that happened
 * to carry a stray value.
 *
 * The constant is resolved when the module is first imported, so each case
 * resets the module registry and imports it again.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

async function gateWith(value: string | undefined): Promise<boolean> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_GATE_OPEN", value as string);
  const mod = await import("@/lib/campaigns");
  return mod.CAMPAIGN_GATE_FORCED_OPEN;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the forced-open gate", () => {
  it("is shut when the variable is not set", async () => {
    expect(await gateWith(undefined)).toBe(false);
  });

  it.each(["", "false", "0", "1", "yes", "TRUE", "True", " true", "true "])(
    "is shut for %o",
    async (value) => {
      expect(await gateWith(value)).toBe(false);
    },
  );

  it("opens only for exactly \"true\"", async () => {
    expect(await gateWith("true")).toBe(true);
  });
});
