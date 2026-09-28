/**
 * Vitest setup file
 * Runs before all tests
 */

import { afterEach, vi } from "vitest";

// Mock environment variables
vi.stubEnv("NODE_ENV", "test");

/*
 * No test asks real DNS anything.
 *
 * The cast route classifies a voting domain's mail host after it answers
 * (lib/vote-domain.ts), with the system resolver unless a test injects its
 * own. The suite runs inside the Netlify build, where a real lookup would be
 * slow at best and a different answer on every run at worst, so any test that
 * reaches the system resolver without injecting one gets a refusal, which the
 * classifier reads as "unknown" and the engine acts on nothing.
 */
vi.mock("node:dns/promises", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:dns/promises")>();
  class Resolver {
    cancel() {}
    async resolveMx(): Promise<never> {
      throw Object.assign(new Error("DNS is not reachable from the test suite"), {
        code: "EREFUSED",
      });
    }
  }
  return { ...real, Resolver, default: { ...real, Resolver } };
});

// Clean up after each test
afterEach(() => {
  // Reset any mocks
  vi.unstubAllEnvs();
});
