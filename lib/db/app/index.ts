/**
 * `lib/db/app` — the SOLE import surface for the app-owned (read-write)
 * database (ADR 0003, issue #4).
 *
 * Nothing downstream may import the generated client (`./generated/client`)
 * directly; everything goes through this module. This keeps the app's
 * write-model client cleanly separated from the future nubebar read-model
 * client (issue #5), which gets its own schema, client, and seam.
 *
 * Runtime connects over Neon's POOLED (PgBouncer) connection — required for
 * Vercel's serverless functions, which open many short-lived connections
 * (ADR 0003) — via the `@prisma/adapter-pg` driver adapter. Migrations use the
 * DIRECT connection instead; that wiring lives in `prisma.config.ts`.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client/client";

export type { HealthCheck } from "./generated/client/client";

/** Whether the app DB connection is wired up (env present). */
export function isAppDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Cache the client across hot-reloads in dev so we don't exhaust connections,
// and reuse it within a single serverless instance in production. Construction
// is lazy so importing this module never throws when the DB isn't configured
// (e.g. the deployed app before the Neon store is wired).
const globalForAppDb = globalThis as unknown as {
  appDbClient: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

/**
 * The app-owned Prisma client, constructed on first use against the pooled
 * connection. Throws if `DATABASE_URL` is absent — guard with
 * {@link isAppDbConfigured} (or use {@link readAppDbHealth}) at boundaries
 * where the DB may not be provisioned yet.
 */
export function getAppDb(): PrismaClient {
  if (client) return client;
  if (globalForAppDb.appDbClient) {
    client = globalForAppDb.appDbClient;
    return client;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the app DB (Neon) is not configured. " +
        "See README → Environment for provisioning steps.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") {
    globalForAppDb.appDbClient = client;
  }
  return client;
}

/** Result of probing the app DB for the `/health` readout. */
export type AppDbHealth =
  | { configured: false }
  | { configured: true; reachable: true; healthChecks: number }
  | { configured: true; reachable: false; error: string };

/**
 * Small end-to-end readout for the health route: confirms the app DB is wired
 * and reachable and reports the `health_checks` row count. Degrades gracefully
 * — never throws — so the health route stays a reliable probe whether or not
 * the DB is provisioned.
 */
export async function readAppDbHealth(): Promise<AppDbHealth> {
  if (!isAppDbConfigured()) return { configured: false };
  try {
    const healthChecks = await getAppDb().healthCheck.count();
    return { configured: true, reachable: true, healthChecks };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
