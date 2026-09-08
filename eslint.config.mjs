import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const serverOnlyPatterns = [
  { group: ["firebase-admin", "firebase-admin/*"], message: "Import firebase-admin only from src/lib/** or src/workers/**." },
  { group: ["nodemailer", "nodemailer/*"], message: "Import nodemailer only from src/lib/** or src/workers/**." },
  { group: ["bullmq", "bullmq/*"], message: "Import bullmq only from src/lib/jobs/** or src/workers/**." },
  { regex: "^stripe(/|$)", message: "Import stripe only from src/lib/stripe or the Stripe webhook route." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".yarn/**",
    ".pnp.cjs",
    ".pnp.loader.mjs",
    "node_modules/**",
    "src/generated/**",
    "docs/**",
    "public/sw.js",
    "public/firebase-messaging-sw.js",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/**",
      "src/workers/**",
      "src/app/api/**",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: serverOnlyPatterns }],
    },
  },
]);

export default eslintConfig;
