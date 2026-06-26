/**
 * `TopRecetasChart` (issue #19) — top-N Recetas by revenue, the same
 * horizontal-bar shape as `MermaChart` (#17) for visual consistency: follows
 * #23's conventions (`ChartContainer`/`ChartConfig` theming,
 * `ChartTooltip`/`ChartTooltipContent`, the `data`+`emptyMessage`
 * empty-state contract, height via `getChartHeightPx`) plus #17's top-N cap
 * with an expansion control. Adds unit-sold count in the tooltip alongside
 * revenue. Pure/props-only — no data fetching;
 * `app/dashboard/sales/page.tsx` fetches via `getSalesSummary` and passes
 * the shaped data down.
 */
"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { CHART_Y_AXIS_WIDTH_PX, getChartHeightPx } from "./chart-layout";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_TOP_N = 15;

export interface TopRecetasChartDatum {
  receta: string;
  /** Revenue — primary bar value, already sorted descending by caller. */
  importe: number;
  /** Unit-sold count — shown in the tooltip only. */
  unidades: number;
}

export interface TopRecetasChartProps {
  data: TopRecetasChartDatum[];
  emptyMessage: string;
  topN?: number;
}

const chartConfig: ChartConfig = {
  importe: {
    label: "Ingresos",
    color: "var(--chart-1)",
  },
};

export function TopRecetasChart({
  data,
  emptyMessage,
  topN = DEFAULT_TOP_N,
}: TopRecetasChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: getChartHeightPx(topN) }}
      >
        {emptyMessage}
      </div>
    );
  }

  const hasMore = data.length > topN;
  const visible = expanded ? data : data.slice(0, topN);

  return (
    <div className="space-y-2">
      <ChartContainer
        config={chartConfig}
        className="w-full aspect-auto"
        style={{ height: getChartHeightPx(visible.length) }}
      >
        <BarChart data={visible} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="receta"
            tickLine={false}
            axisLine={false}
            width={CHART_Y_AXIS_WIDTH_PX}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const datum = item.payload as TopRecetasChartDatum;
                  return [
                    `$${Number(value).toFixed(2)} (${datum.unidades} unidades)`,
                    "Ingresos",
                  ];
                }}
              />
            }
          />
          <Bar dataKey="importe" fill="var(--color-importe)" radius={4} />
        </BarChart>
      </ChartContainer>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? "Mostrar menos"
            : `Mostrar las ${data.length - topN} restantes`}
        </Button>
      )}
    </div>
  );
}

export function TopRecetasChartSkeleton() {
  return (
    <Skeleton
      className="w-full aspect-auto"
      style={{ height: getChartHeightPx(DEFAULT_TOP_N) }}
    />
  );
}
