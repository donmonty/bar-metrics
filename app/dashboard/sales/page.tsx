/**
 * `/dashboard/sales` (issue #19) — the sales-summary metric's drill-down
 * page. Reads the URL-backed date range + Sucursal selection via
 * `lib/dashboard/filters` (issue #16), fetches through `getSalesSummary`
 * (issue #19), and renders both the daily-revenue trend line and the
 * top-Recetas bar chart. Mirrors `/dashboard/merma/page.tsx`'s
 * `Suspense`-wrapped async-section pattern for the loading-skeleton story.
 */
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import { getSalesSummary } from "@/lib/metrics/sales";
import {
  SalesTrendChart,
  SalesTrendChartSkeleton,
} from "@/components/charts/sales-trend-chart";
import {
  TopRecetasChart,
  TopRecetasChartSkeleton,
} from "@/components/charts/top-recetas-chart";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesPage({
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
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Ingresos por día</h2>
        <Suspense
          key={`${sucursalId}-${range.from}-${range.to}`}
          fallback={<SalesTrendChartSkeleton />}
        >
          <SalesTrendChartSection
            sucursalId={sucursalId}
            from={range.from}
            to={range.to}
          />
        </Suspense>
      </div>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recetas más vendidas</h2>
        <Suspense
          key={`${sucursalId}-${range.from}-${range.to}`}
          fallback={<TopRecetasChartSkeleton />}
        >
          <TopRecetasChartSection
            sucursalId={sucursalId}
            from={range.from}
            to={range.to}
          />
        </Suspense>
      </div>
    </div>
  );
}

async function SalesTrendChartSection({
  sucursalId,
  from,
  to,
}: {
  sucursalId: number;
  from: string;
  to: string;
}) {
  const { dailyRevenue } = await getSalesSummary(sucursalId, { from, to });
  return (
    <SalesTrendChart
      data={dailyRevenue}
      emptyMessage="No hay ventas registradas en este periodo."
    />
  );
}

async function TopRecetasChartSection({
  sucursalId,
  from,
  to,
}: {
  sucursalId: number;
  from: string;
  to: string;
}) {
  const { topRecetas } = await getSalesSummary(sucursalId, { from, to });
  return (
    <TopRecetasChart
      data={topRecetas.map((item) => ({
        receta: item.receta,
        importe: item.importe,
        unidades: item.unidades,
      }))}
      emptyMessage="No hay ventas registradas en este periodo."
    />
  );
}
