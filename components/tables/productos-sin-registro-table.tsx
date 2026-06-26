/**
 * `ProductosSinRegistroTable` (issue #20) — plain table for the
 * productos-sin-registro metric: not a chart, so #23's Recharts/
 * `ChartContainer` conventions don't apply here. Still follows the shared
 * empty-state contract (`data` + `emptyMessage: string`, render the named
 * message instead of an empty table shell) and the `<Thing>Skeleton`
 * sibling pattern, sized to the table's shape.
 *
 * Pure/props-only — no data fetching; `app/dashboard/productos-sin-registro/
 * page.tsx` fetches via `getProductosSinRegistro` and passes the shaped
 * data down. Already sorted descending by `importe` and capped at 50 by
 * the metrics layer; this component renders rows in the order given.
 */
import { Skeleton } from "@/components/ui/skeleton";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export type ProductoSinRegistroDatum = {
  codigoPos: string;
  nombre: string;
  ocurrencias: number;
  importe: number;
};

export interface ProductosSinRegistroTableProps {
  data: ProductoSinRegistroDatum[];
  emptyMessage: string;
}

export function ProductosSinRegistroTable({
  data,
  emptyMessage,
}: ProductosSinRegistroTableProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Código POS</th>
          <th className="py-2 pr-4 font-medium">Producto</th>
          <th className="py-2 pr-4 font-medium text-right">Ocurrencias</th>
          <th className="py-2 font-medium text-right">Importe</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((item) => (
          <tr key={item.codigoPos}>
            <td className="py-2 pr-4 font-mono">{item.codigoPos}</td>
            <td className="py-2 pr-4">{item.nombre}</td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {item.ocurrencias}
            </td>
            <td className="py-2 text-right tabular-nums">
              {currencyFormatter.format(item.importe)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProductosSinRegistroTableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}
