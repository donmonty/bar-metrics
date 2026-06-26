/**
 * `/dashboard/productos-sin-registro` (issue #20) — the
 * productos-sin-registro metric's drill-down page. Reads the URL-backed
 * date range + Sucursal selection via `lib/dashboard/filters` (issue #16),
 * fetches through `getProductosSinRegistro` (issue #20), and renders the
 * table. Mirrors `/dashboard/sales/page.tsx`'s `Suspense`-wrapped
 * async-section pattern for the loading-skeleton story.
 */
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import { getProductosSinRegistro } from "@/lib/metrics/productos-sin-registro";
import {
  ProductosSinRegistroTable,
  ProductosSinRegistroTableSkeleton,
} from "@/components/tables/productos-sin-registro-table";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductosSinRegistroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const sucursalIds = session?.user?.sucursalIds ?? [];
  const params = await searchParams;

  const sucursalId = resolveSucursalId(sucursalIds, firstOf(params.sucursal));
  const range = resolveDateRange({
    range: firstOf(params.range),
    from: firstOf(params.from),
    to: firstOf(params.to),
  });

  if (sucursalId === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay Sucursal seleccionada.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Productos sin registro</h2>
      <Suspense
        key={`${sucursalId}-${range.from}-${range.to}`}
        fallback={<ProductosSinRegistroTableSkeleton />}
      >
        <ProductosSinRegistroSection
          sucursalId={sucursalId}
          from={range.from}
          to={range.to}
        />
      </Suspense>
    </div>
  );
}

async function ProductosSinRegistroSection({
  sucursalId,
  from,
  to,
}: {
  sucursalId: number;
  from: string;
  to: string;
}) {
  const items = await getProductosSinRegistro(sucursalId, { from, to });
  return (
    <ProductosSinRegistroTable
      data={items}
      emptyMessage="No hay productos sin registro en este periodo."
    />
  );
}
