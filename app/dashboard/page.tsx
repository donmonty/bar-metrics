/**
 * Dashboard overview landing page (issue #16) — this slice ships only the
 * shell + resolved-filter readout, no metric cards/charts (#17-#21 build
 * those on top). `app/dashboard/layout.tsx` already renders the zero-Sucursal
 * account message and returns early, so by the time this renders the User
 * has at least one assigned Sucursal.
 */
import { auth } from "@/lib/auth";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Sucursal {sucursalId} · {range.from} a {range.to}
      </p>
      <p className="text-sm text-muted-foreground">
        Las métricas (merma, valor de inventario, ventas, productos sin
        registro) se agregarán en próximas iteraciones.
      </p>
    </div>
  );
}
