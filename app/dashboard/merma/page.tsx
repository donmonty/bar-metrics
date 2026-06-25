/**
 * `/dashboard/merma` (issue #17) — the signature metric's drill-down page.
 * Reads the URL-backed date range + Sucursal selection via
 * `lib/dashboard/filters` (issue #16), fetches through `getMermaOverview`
 * (issue #17), and renders `MermaChart` (issue #23's conventions). The chart
 * section is split into its own async component behind `Suspense` so the
 * skeleton shows while the real DB query is in flight, mirroring how a
 * client-fetched chart would loading-state without needing one here.
 */
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import { getMermaOverview } from "@/lib/metrics/merma";
import { MermaChart, MermaChartSkeleton } from "@/components/charts/merma-chart";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function MermaChartSection({
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
    />
  );
}

export default async function MermaPage({
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
      <h2 className="text-lg font-semibold">Merma</h2>
      <Suspense key={`${sucursalId}-${range.from}-${range.to}`} fallback={<MermaChartSkeleton />}>
        <MermaChartSection
          sucursalId={sucursalId}
          from={range.from}
          to={range.to}
        />
      </Suspense>
    </div>
  );
}
