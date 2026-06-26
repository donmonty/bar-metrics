/**
 * `SalesTrendChart` (issue #19) — daily revenue trend line. The first
 * Recharts `LineChart` in this repo; #17/#18/#23's charts are all bar/summary
 * shapes, and `chart-layout.ts`'s `getChartHeightPx(rowCount)` is row-count
 * sizing for a *bar* chart's per-category thinness problem — a line chart
 * has no "row per category" to size against, so it doesn't apply here.
 *
 * Convention landed on for this and any future trend line (e.g. #21's
 * landing page, if it reuses one): a **fixed height** (`TREND_HEIGHT_PX`,
 * 256px / `h-64` — the same fixed height #17/#23's bar charts used before
 * their row-count sizing fix, which is fine here since there's no
 * analogous thinness bug to fix). Still follows #23's other conventions:
 * `ChartContainer`/`ChartConfig` theming, `ChartTooltip`/`ChartTooltipContent`
 * for the tooltip, the `data`+`emptyMessage` empty-state contract, and a
 * sibling `SalesTrendChartSkeleton` sized to the same fixed height.
 */
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

export const TREND_HEIGHT_PX = 256;

export interface SalesTrendChartDatum {
  fecha: string;
  importe: number;
}

export interface SalesTrendChartProps {
  data: SalesTrendChartDatum[];
  emptyMessage: string;
}

const chartConfig: ChartConfig = {
  importe: {
    label: "Ingresos",
    color: "var(--chart-1)",
  },
};

export function SalesTrendChart({ data, emptyMessage }: SalesTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: TREND_HEIGHT_PX }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full aspect-auto"
      style={{ height: TREND_HEIGHT_PX }}
    >
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="fecha" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={60} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Ingresos"]}
            />
          }
        />
        <Area
          dataKey="importe"
          type="monotone"
          fill="var(--color-importe)"
          fillOpacity={0.2}
          stroke="var(--color-importe)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function SalesTrendChartSkeleton() {
  return (
    <Skeleton className="w-full aspect-auto" style={{ height: TREND_HEIGHT_PX }} />
  );
}
