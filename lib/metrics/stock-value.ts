/**
 * `getStockValue` (issue #18) — Stock value (see `docs/CONTEXT.md`): the
 * current total monetary value of all active Botellas on hand at a
 * Sucursal, computed from each Botella's remaining liquid and a unit price,
 * broken down by Almacén (Barra vs. Bodega). A point-in-time snapshot, not
 * windowed by date range. Built exclusively on `lib/db/nubebar` — never the
 * generated Prisma client.
 *
 * Per-bottle formula and "active" filter both mirror Django's own
 * `analytics/reporte_costo_stock.py` / `reporte_stock.py` (the legacy app's
 * existing stock-value report), not a re-derivation from the glossary alone:
 *   volumenMl  = (pesoActual - pesoCristal) * (2 - factorPeso)
 *   costoMl    = precioUnitario / capacidad
 *   costoBotella = costoMl * volumenMl
 *
 * Uses **Botella's own `precio_unitario`**, not Producto's — confirmed by
 * reading `reporte_costo_stock.py`, which builds its `costo_ml` annotation
 * from `F('precio_unitario')` directly on the Botella queryset (no join to
 * Producto for price). Botella's own price is the actual price recorded for
 * that physical bottle at scan time; Producto's is only the catalog
 * template price.
 *
 * A Botella missing any field the formula needs (`precioUnitario`,
 * `capacidad`, `pesoActual`, `pesoCristal`, or its Ingrediente's
 * `factorPeso`) is excluded from the total and breakdown entirely — there's
 * no sound way to estimate a missing input, and Django's own report has the
 * same implicit requirement (its F-expression chain would just produce a
 * null `costo_botella` for such a row).
 */
import {
  findActiveBotellasForSucursal,
  type ActiveBotellaStockRow,
} from "@/lib/db/nubebar";

/** Django's single-char Almacén `tipo` codes (`core/models.py`). */
const ALMACEN_TIPO_BARRA = "1";
const ALMACEN_TIPO_BODEGA = "0";

export type AlmacenBreakdownItem = {
  tipo: "Barra" | "Bodega";
  valor: number;
};

export type StockValueResult = {
  /** Total value across all Almacenes, the sum of `breakdown[].valor`. */
  total: number;
  breakdown: AlmacenBreakdownItem[];
};

function costoBotella(row: ActiveBotellaStockRow): number | null {
  if (
    row.precioUnitario === null ||
    row.capacidad === null ||
    row.capacidad === 0 ||
    row.pesoActual === null ||
    row.pesoCristal === null ||
    row.factorPeso === null
  ) {
    return null;
  }

  const volumenMl = (row.pesoActual - row.pesoCristal) * (2 - row.factorPeso);
  const costoMl = row.precioUnitario / row.capacidad;
  return costoMl * volumenMl;
}

function tipoLabel(tipo: string): "Barra" | "Bodega" | null {
  if (tipo === ALMACEN_TIPO_BARRA) return "Barra";
  if (tipo === ALMACEN_TIPO_BODEGA) return "Bodega";
  return null;
}

export async function getStockValue(
  sucursalId: number,
): Promise<StockValueResult> {
  const rows = await findActiveBotellasForSucursal(sucursalId);

  const valorPorTipo = new Map<"Barra" | "Bodega", number>([
    ["Barra", 0],
    ["Bodega", 0],
  ]);

  for (const row of rows) {
    const label = tipoLabel(row.almacenTipo);
    if (label === null) continue;

    const valor = costoBotella(row);
    if (valor === null) continue;

    valorPorTipo.set(label, valorPorTipo.get(label)! + valor);
  }

  const breakdown: AlmacenBreakdownItem[] = [
    { tipo: "Barra", valor: valorPorTipo.get("Barra")! },
    { tipo: "Bodega", valor: valorPorTipo.get("Bodega")! },
  ];

  return {
    total: breakdown.reduce((sum, item) => sum + item.valor, 0),
    breakdown,
  };
}
