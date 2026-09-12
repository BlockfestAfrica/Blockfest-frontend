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
