/**
 * Dev-only CLI: assign Sucursales to a User (issue #12 / ADR 0002).
 *
 *   npm run db:app:assign-sucursales -- --email me@example.com --sucursales 1,2
 *
 * Calls through `lib/auth.assignSucursales` — does NOT import the generated
 * Prisma client directly, so `lib/auth` stays the single entry point for
 * both production code and this tooling (per the PRD/issue #12). Re-running
 * with a different ID set replaces the assignment; re-running with the same
 * set is a no-op. A non-existent Sucursal ID (checked against the nubebar
 * read model) throws before any row is written.
 *
 * Not deployed anywhere — run from a developer's machine against the real
 * Neon app DB. No admin UI; that's a later, deliberate step.
 */
import { config as loadEnv } from "dotenv";

// Run via `tsx`, not Next.js — `.env.local` isn't auto-loaded the way Next
// dev/build does, same gotcha vitest.config.ts already works around. Must
// happen before `lib/auth` (and its `lib/db/app`/`lib/db/nubebar` imports)
// is loaded, since those read `process.env.*` at call time.
loadEnv({ path: [".env.local", ".env"], quiet: true });

function parseArgs(argv: string[]): { email: string; sucursalIds: number[] } {
  let email: string | undefined;
  let sucursalesRaw: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") {
      email = argv[++i];
    } else if (argv[i] === "--sucursales") {
      sucursalesRaw = argv[++i];
    }
  }

  if (!email) {
    throw new Error("Missing required --email <address>");
  }
  if (!sucursalesRaw) {
    throw new Error("Missing required --sucursales <comma-separated-ids>");
  }

  const sucursalIds = sucursalesRaw.split(",").map((part) => {
    const id = Number(part.trim());
    if (!Number.isInteger(id)) {
      throw new Error(`Invalid Sucursal ID "${part}" — expected an integer.`);
    }
    return id;
  });

  return { email, sucursalIds };
}

async function main() {
  const { email, sucursalIds } = parseArgs(process.argv.slice(2));
  // Dynamic import (not a static one) so `dotenv` has already populated
  // `process.env` before `lib/auth` evaluates — static imports are hoisted
  // and would run before `loadEnv()` above.
  const { assignSucursales } = await import("@/lib/auth");
  await assignSucursales(email, sucursalIds);
  console.log(`Assigned Sucursal(s) [${sucursalIds.join(", ")}] to ${email}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
