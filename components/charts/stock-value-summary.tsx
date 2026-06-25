/**
 * `StockValueSummary` (issue #18) — big number + Almacén (Barra/Bodega)
 * breakdown for the stock-value metric. A plain list rather than a Recharts
 * chart: per the issue, a two-way Barra/Bodega split reads better as a
 * direct comparison than as a bar chart, so this skips #23's Recharts
 * conventions entirely (no `ChartContainer`/theming needed for two rows of
 * text) but still follows its other two conventions — a `<Thing>Skeleton`
 * sibling sized to the same footprint, and rendering $0 plainly rather than
 * a separate empty-state message (per the issue, zero Botellas is not a
 * distinct empty case here).
 *
 * Pure/props-only — no data fetching; `app/dashboard/stock-value/page.tsx`
 * fetches via `getStockValue` and passes the shaped data down.
 */
import { Skeleton } from "@/components/ui/skeleton";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export type StockValueSummaryDatum = {
  tipo: "Barra" | "Bodega";
  valor: number;
};

export interface StockValueSummaryProps {
  total: number;
  breakdown: StockValueSummaryDatum[];
}

export function StockValueSummary({
  total,
  breakdown,
}: StockValueSummaryProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Valor de inventario</p>
        <p className="text-4xl font-semibold tabular-nums">
          {currencyFormatter.format(total)}
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border">
        {breakdown.map((item) => (
          <li
            key={item.tipo}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm text-muted-foreground">{item.tipo}</span>
            <span className="text-sm font-medium tabular-nums">
              {currencyFormatter.format(item.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StockValueSummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
