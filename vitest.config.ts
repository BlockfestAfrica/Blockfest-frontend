import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    /**
     * Pinned, so a test result never depends on the machine running it.
     *
     * The suite now runs inside the Netlify build, which carries the real site
     * variables. NEXT_PUBLIC_CAMPAIGN_GATE_OPEN is set to true there to open
     * registration ahead of launch, so a test asserting the pre-launch locked
     * state passed locally and failed on deploy, having found the production
     * configuration rather than a bug.
     *
     * The default here is the shut gate, because that is the state the campaign
     * spends most of its life in and the one worth defending. Tests that care
     * about the other state set it themselves with vi.stubEnv and a module
     * reset, which is the only way to move a value that is read once at import.
     */
    env: {
      NEXT_PUBLIC_CAMPAIGN_GATE_OPEN: "",
      /*
       * The clock, pinned for the same reason the variables above are.
       *
       * The campaign is written and enforced in Lagos time, and a date test
       * that asks the RUNNER what day an instant falls on gets a different
       * answer on every laptop. The campaign's 2026-10-17T23:59:59+01:00
       * close reads as the 17th in Lagos and on Netlify's UTC builders, and
       * as the 18th anywhere east of UTC+2, so the suite passed in CI and
       * failed on a machine that had moved timezone.
       *
       * UTC because that is what the builders run, so a green suite locally
       * means a green suite on deploy. Tests that care about the Lagos
       * calendar ask for it explicitly with timeZone: "Africa/Lagos", which
       * is the correct question anyway and is now the only way that question
       * gets asked.
       */
      TZ: "UTC",
    },
    include: ["__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // server-only throws on import so that a server module cannot be pulled
      // into a client bundle. That guard is worth keeping in the build and is
      // meaningless here, where there is no client bundle and no boundary to
      // cross, so it resolves to an empty module instead of failing the suite.
      "server-only": path.resolve(__dirname, "./__tests__/stubs/server-only.ts"),
    },
  },
});
