/**
 * `/dashboard` landing overview page (issue #21) — replaces the #16
 * placeholder with four compact metric cards, composing the existing query
 * functions and chart/table components from #17-#20 verbatim with smaller
 * data (a smaller `topN`/array slice), not new chart shapes or query logic.
 * Each card has its own `Suspense` boundary, mirroring every drill-down
 * page's loading-skeleton pattern, so cards resolve independently. Stock
 * value deliberately ignores the date range, same as `/dashboard/stock-value`.
 */
import { Suspense } from "react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMermaOverview } from "@/lib/metrics/merma";
import { MermaChart, MermaChartSkeleton } from "@/components/charts/merma-chart";
import { getStockValue } from "@/lib/metrics/stock-value";
import {
  StockValueSummary,
  StockValueSummarySkeleton,
} from "@/components/charts/stock-value-summary";
import { getSalesSummary } from "@/lib/metrics/sales";
import {
  TopRecetasChart,
  TopRecetasChartSkeleton,
} from "@/components/charts/top-recetas-chart";
import { getProductosSinRegistro } from "@/lib/metrics/productos-sin-registro";
import {
  ProductosSinRegistroTable,
  ProductosSinRegistroTableSkeleton,
} from "@/components/tables/productos-sin-registro-table";

const CARD_TOP_N = 5;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function MetricCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function MermaCardSection({
  sucursalId,
  from,
  to,
}: {
  sucursalId: number;
  from: string;
  to: string;
}) {
  const { items } = await getMermaOverview(sucursalId, { from, to });

  return (
    <MermaChart
      data={items.map((item) => ({
        ingrediente: item.ingrediente,
        porcentaje: item.porcentaje,
        deltaMl: item.deltaMl,
      }))}
      emptyMessage="No hay inspecciones registradas en este periodo."
      topN={CARD_TOP_N}
    />
  );
}

async function StockValueCardSection({ sucursalId }: { sucursalId: number }) {
  const { total, breakdown } = await getStockValue(sucursalId);

  return <StockValueSummary total={total} breakdown={breakdown} />;
}

async function TopRecetasCardSection({
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
      topN={CARD_TOP_N}
    />
  );
}

async function ProductosSinRegistroCardSection({
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
      data={items.slice(0, CARD_TOP_N)}
      emptyMessage="No hay productos sin registro en este periodo."
    />
  );
}

export default async function DashboardPage({
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
    <div className="grid gap-4 sm:grid-cols-2">
      <MetricCard title="Merma" href="/dashboard/merma">
        <Suspense
          key={`${sucursalId}-${range.from}-${range.to}`}
          fallback={<MermaChartSkeleton />}
        >
          <MermaCardSection
            sucursalId={sucursalId}
            from={range.from}
            to={range.to}
          />
        </Suspense>
      </MetricCard>

      <MetricCard title="Valor de inventario" href="/dashboard/stock-value">
        <Suspense key={sucursalId} fallback={<StockValueSummarySkeleton />}>
          <StockValueCardSection sucursalId={sucursalId} />
        </Suspense>
      </MetricCard>

      <MetricCard title="Recetas más vendidas" href="/dashboard/sales">
        <Suspense
          key={`${sucursalId}-${range.from}-${range.to}`}
          fallback={<TopRecetasChartSkeleton />}
        >
          <TopRecetasCardSection
            sucursalId={sucursalId}
            from={range.from}
            to={range.to}
          />
        </Suspense>
      </MetricCard>

      <MetricCard
        title="Productos sin registro"
        href="/dashboard/productos-sin-registro"
      >
        <Suspense
          key={`${sucursalId}-${range.from}-${range.to}`}
          fallback={<ProductosSinRegistroTableSkeleton />}
        >
          <ProductosSinRegistroCardSection
            sucursalId={sucursalId}
            from={range.from}
            to={range.to}
          />
        </Suspense>
      </MetricCard>
    </div>
  );
}
