/**
 * `/dashboard/stock-value` (issue #18) — the stock-value metric's
 * drill-down page. Resolves the URL-backed Sucursal selection via
 * `lib/dashboard/filters` (issue #16), fetches through `getStockValue`
 * (issue #18), and renders `StockValueSummary`. Deliberately does NOT read
 * or render the date-range control at all — stock value is a point-in-time
 * snapshot, not windowed by date range (see `docs/CONTEXT.md`). The summary
 * section is split into its own async component behind `Suspense` so the
 * skeleton shows while the real DB query is in flight, mirroring
 * `/dashboard/merma`'s loading-state pattern.
 */
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { resolveSucursalId } from "@/lib/dashboard/filters";
import { getStockValue } from "@/lib/metrics/stock-value";
import {
  StockValueSummary,
  StockValueSummarySkeleton,
} from "@/components/charts/stock-value-summary";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function StockValueSection({ sucursalId }: { sucursalId: number }) {
  const { total, breakdown } = await getStockValue(sucursalId);

  return <StockValueSummary total={total} breakdown={breakdown} />;
}

export default async function StockValuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const sucursalIds = session?.user?.sucursalIds ?? [];
  const params = await searchParams;

  const sucursalId = resolveSucursalId(sucursalIds, firstOf(params.sucursal));

  if (sucursalId === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay Sucursal seleccionada.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Valor de inventario</h2>
      <Suspense
        key={sucursalId}
        fallback={<StockValueSummarySkeleton />}
      >
        <StockValueSection sucursalId={sucursalId} />
      </Suspense>
    </div>
  );
}
