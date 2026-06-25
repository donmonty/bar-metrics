/**
 * `MermaChart` (issue #17) — the dashboard's signature chart. Follows #23's
 * conventions (see `components/charts/ranked-bar-chart.tsx`'s header):
 * `ChartContainer`/`ChartConfig` theming, `ChartTooltip`/`ChartTooltipContent`
 * for the tooltip, the `data`+`emptyMessage` empty-state contract, and a
 * sibling `MermaChartSkeleton` sized to the same fixed height. Pure/props-only
 * — no data fetching; `app/dashboard/merma/page.tsx` fetches via
 * `getMermaOverview` and passes the shaped data down.
 *
 * Adds one thing the #23 POC didn't need: a top-N cap with an expansion
 * control, since merma's Ingrediente list can run long and the chart must
 * stay readable by default.
 */
"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_HEIGHT = "h-64";
const DEFAULT_TOP_N = 15;

export interface MermaChartDatum {
  ingrediente: string;
  /** % variance — primary bar value, already sorted descending by caller. */
  porcentaje: number;
  /** Absolute mL/unit delta — shown in the tooltip only. */
  deltaMl: number;
}

export interface MermaChartProps {
  data: MermaChartDatum[];
  emptyMessage: string;
  topN?: number;
}

const chartConfig: ChartConfig = {
  porcentaje: {
    label: "Merma %",
    color: "var(--chart-1)",
  },
};

export function MermaChart({
  data,
  emptyMessage,
  topN = DEFAULT_TOP_N,
}: MermaChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) {
    return (
      <div
        className={`flex ${CHART_HEIGHT} items-center justify-center text-sm text-muted-foreground`}
      >
        {emptyMessage}
      </div>
    );
  }

  const hasMore = data.length > topN;
  const visible = expanded ? data : data.slice(0, topN);

  return (
    <div className="space-y-2">
      <ChartContainer config={chartConfig} className={`${CHART_HEIGHT} w-full`}>
        <BarChart data={visible} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="ingrediente"
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const datum = item.payload as MermaChartDatum;
                  return [
                    `${Number(value).toFixed(1)}% (${datum.deltaMl.toFixed(1)} mL)`,
                    "Merma",
                  ];
                }}
              />
            }
          />
          <Bar dataKey="porcentaje" fill="var(--color-porcentaje)" radius={4} />
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
            : `Mostrar los ${data.length - topN} restantes`}
        </Button>
      )}
    </div>
  );
}

export function MermaChartSkeleton() {
  return <Skeleton className={`${CHART_HEIGHT} w-full`} />;
}
