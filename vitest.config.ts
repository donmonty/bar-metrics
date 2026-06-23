import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Vitest, unlike Next.js, doesn't auto-load `.env.local`. Load it here so
// DATABASE_URL is visible to the env-gated app-DB integration test.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: {
    // Mirror the `@/*` -> project-root path alias from tsconfig.json so tests
    // can import via `@/lib/...` like the app does.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
});
