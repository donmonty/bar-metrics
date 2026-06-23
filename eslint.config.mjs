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
  // Keep ESLint focused on code quality; Prettier owns formatting.
  ...compat.extends("prettier"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // Generated Prisma client — regenerated on install, never hand-edited.
      "lib/db/app/generated/**",
    ],
  },
];

export default eslintConfig;
