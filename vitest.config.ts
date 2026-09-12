import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
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
