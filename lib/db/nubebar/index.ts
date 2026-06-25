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

/**
 * Of the given Sucursal IDs, returns the subset that actually exist in the
 * nubebar read model (issue #12). `lib/auth.assignSucursales` uses this to
 * validate IDs before writing `UserSucursal` rows — any ID missing from the
 * returned set is a typo and should fail the assignment before any writes.
 */
export async function findExistingSucursalIds(
  ids: number[],
): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await getClient().core_sucursal.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return rows.map((row) => row.id).filter((id): id is number => id !== null);
}

/** Minimal Sucursal shape exposed for display purposes (issue #16). */
export type SucursalSummary = { id: number; nombre: string };

/**
 * Looks up display info (id + nombre) for a set of Sucursal IDs (issue #16) —
 * used by the dashboard's Sucursal switcher, which needs names for the IDs
 * already known-valid via `session.user.sucursalIds`/`findExistingSucursalIds`.
 */
export async function findSucursalesByIds(
  ids: number[],
): Promise<SucursalSummary[]> {
  if (ids.length === 0) return [];
  return getClient().core_sucursal.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

/** One Ingrediente's merma row from a single Inspección's report (issue #17). */
export type MermaIngredienteRow = {
  ingredienteId: number;
  ingrediente: string;
  consumoVentas: number;
  consumoReal: number;
};

/**
 * `core_mermaingrediente` rows for the given Sucursal whose Inspección
 * `fecha_alta` falls within `[from, to]` (inclusive) — issue #17. Joins
 * through `core_reportemermas` -> `core_inspeccion` to scope by Sucursal and
 * date, and through `core_ingrediente` for display names. Rows with a null
 * `consumo_ventas`/`consumo_real` (an Inspección the Django app hasn't
 * totalled yet) are dropped — there is nothing to aggregate for them.
 */
export async function findMermaIngredientesForSucursal(
  sucursalId: number,
  from: Date,
  to: Date,
): Promise<MermaIngredienteRow[]> {
  const rows = await getClient().core_mermaingrediente.findMany({
    where: {
      consumo_ventas: { not: null },
      consumo_real: { not: null },
      core_reportemermas: {
        core_inspeccion: {
          sucursal_id: sucursalId,
          fecha_alta: { gte: from, lte: to },
        },
      },
    },
    select: {
      ingrediente_id: true,
      consumo_ventas: true,
      consumo_real: true,
      core_ingrediente: { select: { nombre: true } },
    },
  });

  return rows.map((row) => ({
    ingredienteId: row.ingrediente_id,
    ingrediente: row.core_ingrediente.nombre,
    consumoVentas: Number(row.consumo_ventas),
    consumoReal: Number(row.consumo_real),
  }));
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
