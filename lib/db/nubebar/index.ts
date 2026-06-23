/**
 * `lib/db/nubebar` — the SOLE import surface for the nubebar read model (the
 * legacy Django Postgres on DigitalOcean; ADR 0003, issue #5).
 *
 * Nothing downstream may import the generated client (`./generated/client`)
 * directly. Unlike `lib/db/app`, this seam is **read-only by construction**:
 * it only ever exposes `count`/`findMany`-style read helpers, never `create`,
 * `update`, `delete`, or the raw Prisma client itself — Django owns this
 * schema for writes, and this app must never touch it. Treat the introspected
 * schema (`prisma/nubebar/schema.prisma`) as generated, read-only output; it
 * is refreshed via `npm run db:nubebar:pull`, never hand-edited.
 *
 * Runtime connects over a DigitalOcean Connection Pool (PgBouncer-backed) —
 * required for Vercel's serverless functions, which open many short-lived
 * connections (ADR 0003) — via the `@prisma/adapter-pg` driver adapter.
 * `prisma db pull` (introspection) is the only Prisma CLI command ever run
 * against this datasource; see `prisma.nubebar.config.ts`.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client/client";

/** Whether the nubebar read connection is wired up (env present). */
export function isNubebarDbConfigured(): boolean {
  return Boolean(process.env.NUBEBAR_DATABASE_URL);
}

// Cache the client across hot-reloads in dev so we don't exhaust connections,
// and reuse it within a single serverless instance in production. Construction
// is lazy so importing this module never throws when the DB isn't configured.
const globalForNubebarDb = globalThis as unknown as {
  nubebarDbClient: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client) return client;
  if (globalForNubebarDb.nubebarDbClient) {
    client = globalForNubebarDb.nubebarDbClient;
    return client;
  }

  const connectionString = process.env.NUBEBAR_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "NUBEBAR_DATABASE_URL is not set — the nubebar read model is not " +
        "configured. See README → Environment for the connection pool setup.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") {
    globalForNubebarDb.nubebarDbClient = client;
  }
  return client;
}

/** Count of Sucursales (bars/venues) in the nubebar read model. */
export async function countSucursales(): Promise<number> {
  return getClient().core_sucursal.count();
}

/** Result of probing the nubebar read model for the `/health` readout. */
export type NubebarDbHealth =
  | { configured: false }
  | { configured: true; reachable: true; sucursales: number }
  | { configured: true; reachable: false; error: string };

/**
 * Small end-to-end readout for the health route: confirms the nubebar
 * read-only connection is wired and reachable and reports the Sucursal count.
 * Degrades gracefully — never throws — so the health route stays a reliable
 * probe whether or not the connection is provisioned.
 */
export async function readNubebarDbHealth(): Promise<NubebarDbHealth> {
  if (!isNubebarDbConfigured()) return { configured: false };
  try {
    const sucursales = await countSucursales();
    return { configured: true, reachable: true, sucursales };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
