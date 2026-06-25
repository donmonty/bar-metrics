/**
 * `getMermaOverview` (issue #17) — the signature metric (see
 * `docs/CONTEXT.md`): `merma = consumo_ventas − consumo_real`, aggregated per
 * Ingrediente across every Inspección a Sucursal had in a date range (not
 * per-Inspección; drilling into a single Inspección is out of scope). Built
 * exclusively on `lib/db/nubebar` — never the generated Prisma client.
 *
 * Each Ingrediente's `consumo_ventas`/`consumo_real` are summed across the
 * window first, then the % variance is derived from the sums (not averaged
 * from each Inspección's own `porcentaje`) — summing percentages would
 * misweight Inspecciones with small volumes against ones with large volumes.
 */
import {
  findMermaIngredientesForSucursal,
  type MermaIngredienteRow,
} from "@/lib/db/nubebar";

export type DateRangeInput = { from: string; to: string };

export type MermaOverviewItem = {
  ingredienteId: number;
  ingrediente: string;
  /** % variance — primary value, `(consumoVentas - consumoReal) / consumoVentas * 100`. */
  porcentaje: number;
  /** Absolute mL/unit delta — secondary value, for the tooltip. */
  deltaMl: number;
};

export type MermaOverviewResult = {
  /** Sorted descending by `porcentaje`. */
  items: MermaOverviewItem[];
};

function aggregateByIngrediente(
  rows: MermaIngredienteRow[],
): MermaOverviewItem[] {
  const totals = new Map<
    number,
    { ingrediente: string; consumoVentas: number; consumoReal: number }
  >();

  for (const row of rows) {
    const existing = totals.get(row.ingredienteId);
    if (existing) {
      existing.consumoVentas += row.consumoVentas;
      existing.consumoReal += row.consumoReal;
    } else {
      totals.set(row.ingredienteId, {
        ingrediente: row.ingrediente,
        consumoVentas: row.consumoVentas,
        consumoReal: row.consumoReal,
      });
    }
  }

  return Array.from(totals.entries())
    .map(([ingredienteId, totalsForIngrediente]) => {
      const deltaMl =
        totalsForIngrediente.consumoVentas - totalsForIngrediente.consumoReal;
      const porcentaje =
        totalsForIngrediente.consumoVentas !== 0
          ? (deltaMl / totalsForIngrediente.consumoVentas) * 100
          : 0;
      return {
        ingredienteId,
        ingrediente: totalsForIngrediente.ingrediente,
        porcentaje,
        deltaMl,
      };
    })
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

export async function getMermaOverview(
  sucursalId: number,
  dateRange: DateRangeInput,
): Promise<MermaOverviewResult> {
  const rows = await findMermaIngredientesForSucursal(
    sucursalId,
    new Date(dateRange.from),
    new Date(dateRange.to),
  );
  return { items: aggregateByIngrediente(rows) };
}
