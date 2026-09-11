import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Build output written by the Netlify CLI when deploying or linking.
      // Without this, `npm run lint` reports thousands of problems in
      // generated bundles and buries the handful that are actually ours.
      ".netlify/**",
      // Isolated build dir, used so a production build and a running dev
      // server do not fight over .next. See distDir in next.config.ts.
      ".next-build/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
