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
       * Emptied for the same reason, and that is not the whole of it.
       *
       * A developer with a local DATABASE_URL would otherwise get different
       * results from the same suite. But the connection also resolves through
       * getConnectionString(), which succeeds inside a Netlify build because a
       * database is attached there, and no entry in this table can reach that.
       * A test asserting there is no connection has to arrange the absence by
       * mocking the resolver: assuming it from an unset variable passes locally
       * and fails the one build that gates deploys, which is how this comment
       * came to be written.
       */
      DATABASE_URL: "",
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
