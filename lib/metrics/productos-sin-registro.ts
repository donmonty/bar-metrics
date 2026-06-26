/**
 * `getProductosSinRegistro` (issue #20) — productos-sin-registro metric:
 * unmatched POS sales lines (a data-quality/leakage signal), aggregated by
 * `codigo_pos` within a date range, after excluding any `codigo_pos` that
 * has since been registered as a Receta for the Sucursal. Built exclusively
 * on `lib/db/nubebar` — never the generated Prisma client.
 *
 * Grouped by `codigo_pos` rather than `nombre`: `codigo_pos` is the stable
 * POS identifier, while `nombre` can vary slightly across POS exports for
 * the same product.
 */
import {
  findProductosSinRegistroForSucursal,
  type ProductoSinRegistroRow,
} from "@/lib/db/nubebar";

export type DateRangeInput = { from: string; to: string };

export type ProductoSinRegistroItem = {
  codigoPos: string;
  nombre: string;
  ocurrencias: number;
  importe: number;
};

const TOP_N = 50;

function aggregateByCodigoPos(
  rows: ProductoSinRegistroRow[],
): ProductoSinRegistroItem[] {
  const totals = new Map<
    string,
    { nombre: string; ocurrencias: number; importe: number }
  >();

  for (const row of rows) {
    const existing = totals.get(row.codigoPos);
    if (existing) {
      existing.ocurrencias += 1;
      existing.importe += row.importe;
    } else {
      totals.set(row.codigoPos, {
        nombre: row.nombre,
        ocurrencias: 1,
        importe: row.importe,
      });
    }
  }

  return Array.from(totals.entries())
    .map(([codigoPos, totalsForCodigo]) => ({
      codigoPos,
      nombre: totalsForCodigo.nombre,
      ocurrencias: totalsForCodigo.ocurrencias,
      importe: totalsForCodigo.importe,
    }))
    .sort((a, b) => b.importe - a.importe)
    .slice(0, TOP_N);
}

export async function getProductosSinRegistro(
  sucursalId: number,
  dateRange: DateRangeInput,
): Promise<ProductoSinRegistroItem[]> {
  const rows = await findProductosSinRegistroForSucursal(
    sucursalId,
    new Date(dateRange.from),
    new Date(dateRange.to),
  );

  return aggregateByCodigoPos(rows);
}
