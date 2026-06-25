/**
 * Chart conventions (issue #23) — read this before building a metric chart
 * in #17-#20. This component is a throwaway proof-of-concept; it is NOT
 * imported by real dashboard pages. Copy the *pattern*, not the component.
 *
 * 1. Theming: build on shadcn's `ChartContainer` + a `ChartConfig` (see
 *    `components/ui/chart.tsx`). Don't configure Recharts colors/fonts by
 *    hand — `ChartContainer` injects `--color-<key>` CSS vars per series
 *    from the config, and Recharts elements reference them via
 *    `fill="var(--color-<key>)"`.
 * 2. Tooltip: always render `<ChartTooltip content={<ChartTooltipContent />} />`
 *    inside the chart instead of Recharts' default tooltip. Pass
 *    `formatter`/`labelFormatter` for metric-specific value shaping (e.g. the
 *    absolute mL/unit delta merma needs, per #17) rather than restyling the
 *    tooltip box itself.
 * 3. Empty-state prop contract: every chart component takes a `data` array
 *    and an `emptyMessage: string` prop. When `data.length === 0`, render
 *    the named empty message (centered, muted text, same footprint as the
 *    chart) INSTEAD OF an empty/misleading chart — never render axes or a
 *    bare chart frame with no bars.
 * 4. Loading skeleton: export a sibling `<Thing>Skeleton` component sized to
 *    the same footprint as the real chart (use the same fixed height) using
 *    shadcn's `<Skeleton>`. Pages render the skeleton while fetching, then
 *    swap to the real component once data resolves — don't build loading
 *    state into the chart component itself.
 */
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_HEIGHT = "h-64";

export interface RankedBarDatum {
  label: string;
  value: number;
}

export interface RankedBarChartProps {
  data: RankedBarDatum[];
  emptyMessage: string;
}

const chartConfig: ChartConfig = {
  value: {
    label: "Valor",
    color: "var(--chart-1)",
  },
};

export function RankedBarChart({ data, emptyMessage }: RankedBarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`flex ${CHART_HEIGHT} items-center justify-center text-sm text-muted-foreground`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={`${CHART_HEIGHT} w-full`}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function RankedBarChartSkeleton() {
  return <Skeleton className={`${CHART_HEIGHT} w-full`} />;
}
