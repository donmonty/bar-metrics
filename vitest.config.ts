import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Vitest, unlike Next.js, doesn't auto-load `.env.local`. Load it here so
// DATABASE_URL is visible to the env-gated app-DB integration test.
loadEnv({ path: [".env.local", ".env"], quiet: true });

const require = createRequire(import.meta.url);

export default defineConfig({
  esbuild: {
    // Vite/esbuild defaults to the classic JSX transform unless told
    // otherwise; this repo's components rely on the automatic runtime (no
    // `import React` in scope), matching Next's own JSX handling.
    jsx: "automatic",
  },
  resolve: {
    // Mirror the `@/*` -> project-root path alias from tsconfig.json so tests
    // can import via `@/lib/...` like the app does.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // next-auth (issue #11) imports the bare specifier "next/server",
      // which Next's own webpack/turbopack build resolves specially. Plain
      // Node resolution (what Vitest uses for externalized node_modules
      // deps) can't find it without an explicit alias to the real file.
      "next/server": require.resolve("next/server"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    server: {
      // Forces next-auth's CJS/ESM module through Vite's transform (and
      // therefore the alias above) instead of Node's native resolver, which
      // is what externalized deps use by default and what fails to resolve
      // "next/server" outside Next's own build.
      deps: { inline: [/next-auth/, /@auth\/core/, /@auth\/prisma-adapter/] },
    },
  },
});
