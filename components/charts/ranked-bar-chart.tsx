/**
 * Chart conventions (issue #23, sizing corrected by the chart-styling fix
 * that followed #17) — read this before building a metric chart in
 * #17-#20. This component is a throwaway proof-of-concept; it is NOT
 * imported by real dashboard pages. Copy the *pattern*, not the component.
 *
 * 1. Theming: build on shadcn's `ChartContainer` + a `ChartConfig` (see
 *    `components/ui/chart.tsx`). Don't configure Recharts colors/fonts by
 *    hand — `ChartContainer` injects `--color-<key>` CSS vars per series
 *    from the config, and Recharts elements reference them via
 *    `fill="var(--color-<key>)"`. The grayscale `--chart-1..5` tokens in
 *    `app/globals.css` are deliberately low-saturation (this repo's
 *    `neutral`/`base-nova` shadcn style) but must still clear a real
 *    contrast threshold against the white chart background — don't
 *    reintroduce a near-white fill.
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
 * 4. Sizing: do NOT give `ChartContainer` a fixed height. With several bars
 *    packed into a fixed height, each bar's row slot gets too thin, and
 *    Recharts' `YAxis` auto-wraps a category label onto two lines when it
 *    doesn't fit `width` — a too-thin row then visually collides with the
 *    wrapped label. Use `getChartHeightPx(visibleRowCount)` from
 *    `./chart-layout` instead, which sizes height off the number of bars
 *    actually rendered (a per-row minimum tall enough for a wrapped 2-line
 *    label), and `CHART_Y_AXIS_WIDTH_PX` for the `YAxis`'s `width`.
 * 5. Loading skeleton: export a sibling `<Thing>Skeleton` component sized
 *    with the same `getChartHeightPx` call the real component would use for
 *    its expected row count (e.g. the top-N default) using shadcn's
 *    `<Skeleton>`. Pages render the skeleton while fetching, then swap to
 *    the real component once data resolves — don't build loading state into
 *    the chart component itself.
 */
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  CHART_Y_AXIS_WIDTH_PX,
  getChartHeightPx,
} from "./chart-layout";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_ROW_COUNT = 5;

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
  const heightPx = getChartHeightPx(
    data.length === 0 ? DEFAULT_ROW_COUNT : data.length,
  );

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: heightPx }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full aspect-auto"
      style={{ height: heightPx }}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={CHART_Y_AXIS_WIDTH_PX}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function RankedBarChartSkeleton() {
  return (
    <Skeleton
      className="w-full aspect-auto"
      style={{ height: getChartHeightPx(DEFAULT_ROW_COUNT) }}
    />
  );
}
