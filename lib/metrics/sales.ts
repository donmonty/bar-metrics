/**
 * `getSalesSummary` (issue #19) — sales summary: a daily-revenue trend
 * across a date range plus a top-N Recetas ranking by revenue, each with
 * its unit-sold count. Built exclusively on `lib/db/nubebar` — never the
 * generated Prisma client. Unlike #18's point-in-time stock value, both
 * halves of this metric are aggregated over the date range.
 *
 * `fecha` is bucketed by its ISO date string (already date-only in the DB —
 * `core_venta.fecha` is `@db.Date`) rather than re-deriving a day key from a
 * `Date` object's local timezone.
 */
import { findVentasForSucursal, type VentaSalesRow } from "@/lib/db/nubebar";

export type DateRangeInput = { from: string; to: string };

export type DailyRevenuePoint = {
  fecha: string;
  importe: number;
};

export type TopRecetaItem = {
  recetaId: number;
  receta: string;
  importe: number;
  unidades: number;
};

export type SalesSummaryResult = {
  /** Sorted ascending by `fecha`. */
  dailyRevenue: DailyRevenuePoint[];
  /** Sorted descending by `importe`. */
  topRecetas: TopRecetaItem[];
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function aggregateDailyRevenue(rows: VentaSalesRow[]): DailyRevenuePoint[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const fecha = toIsoDate(row.fecha);
    totals.set(fecha, (totals.get(fecha) ?? 0) + row.importe);
  }

  return Array.from(totals.entries())
    .map(([fecha, importe]) => ({ fecha, importe }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function aggregateTopRecetas(rows: VentaSalesRow[]): TopRecetaItem[] {
  const totals = new Map<
    number,
    { receta: string; importe: number; unidades: number }
  >();

  for (const row of rows) {
    const existing = totals.get(row.recetaId);
    if (existing) {
      existing.importe += row.importe;
      existing.unidades += row.unidades;
    } else {
      totals.set(row.recetaId, {
        receta: row.receta,
        importe: row.importe,
        unidades: row.unidades,
      });
    }
  }

  return Array.from(totals.entries())
    .map(([recetaId, totalsForReceta]) => ({
      recetaId,
      receta: totalsForReceta.receta,
      importe: totalsForReceta.importe,
      unidades: totalsForReceta.unidades,
    }))
    .sort((a, b) => b.importe - a.importe);
}

export async function getSalesSummary(
  sucursalId: number,
  dateRange: DateRangeInput,
): Promise<SalesSummaryResult> {
  const rows = await findVentasForSucursal(
    sucursalId,
    new Date(dateRange.from),
    new Date(dateRange.to),
  );

  return {
    dailyRevenue: aggregateDailyRevenue(rows),
    topRecetas: aggregateTopRecetas(rows),
  };
}
