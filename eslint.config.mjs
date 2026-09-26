import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Plan with friends reaches the rest of the app only through its bridge/, so upstream changes stay a one-folder fix.
  {
    files: ["src/features/plan-with-friends/**"],
    ignores: ["src/features/plan-with-friends/bridge/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/*", "@/components/*", "@/app/*"], message: "Import app code through src/features/plan-with-friends/bridge/ instead." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied from node_modules at install time.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
