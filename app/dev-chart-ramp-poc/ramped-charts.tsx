"use client";

/**
 * Prototype copies of the real charts, issue #63. Throwaway.
 *
 * Each one is its shipped counterpart line-for-line, with exactly ONE change,
 * so the switch on screen isolates the decision:
 *
 *  - `RampedBarChart` — the ranked-bar question. The shipped charts give every
 *    bar one flat `var(--color-<key>)`. This indexes the ramp per ROW instead,
 *    via a `fill` key on each datum (issue #60's finding: `<Cell>` is removed
 *    in Recharts 4.0, a `fill` on the row is the supported route). Rows past
 *    step 5 hold at step 5 — a ranked chart runs to 15 by default.
 *  - `GradientAreaChart` — the area-fill question. The shipped trend chart
 *    fills at a flat `fillOpacity={0.2}`. This swaps in a `<linearGradient>`
 *    that fades the accent out downward, as the reference's charts do.
 *
 * Everything else — sizing, tooltip contract, empty state — is untouched, and
 * the shipped components are rendered directly whenever the treatment on
 * screen is the shipped one.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_Y_AXIS_WIDTH_PX,
  getChartHeightPx,
} from "@/components/charts/chart-layout";
import { TREND_HEIGHT_PX } from "@/components/charts/sales-trend-chart";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const RAMP_STEPS = 5;

/** Step N of the ramp for row `index`, holding at the last step. */
export function stepForRank(index: number): string {
  return `var(--chart-${Math.min(index + 1, RAMP_STEPS)})`;
}

export function RampedBarChart<T extends Record<string, unknown>>({
  data,
  categoryKey,
  valueKey,
  config,
  tooltip,
}: {
  data: T[];
  categoryKey: keyof T & string;
  valueKey: keyof T & string;
  config: ChartConfig;
  tooltip?: React.ComponentProps<typeof ChartTooltipContent>["formatter"];
}) {
  const ranked = data.map((row, index) => ({
    ...row,
    fill: stepForRank(index),
  }));

  return (
    <ChartContainer
      config={config}
      className="w-full aspect-auto"
      style={{ height: getChartHeightPx(data.length) }}
    >
      <BarChart data={ranked} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={categoryKey as never}
          tickLine={false}
          axisLine={false}
          width={CHART_Y_AXIS_WIDTH_PX}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={tooltip} />} />
        <Bar dataKey={valueKey as never} radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function GradientAreaChart({
  data,
  config,
}: {
  data: { fecha: string; importe: number }[];
  config: ChartConfig;
}) {
  return (
    <ChartContainer
      config={config}
      className="w-full aspect-auto"
      style={{ height: TREND_HEIGHT_PX }}
    >
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="poc-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-importe)"
              stopOpacity={0.45}
            />
            <stop
              offset="100%"
              stopColor="var(--color-importe)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="fecha" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={60} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                `$${Number(value).toFixed(2)}`,
                "Ingresos",
              ]}
            />
          }
        />
        <Area
          dataKey="importe"
          type="monotone"
          fill="url(#poc-trend-fill)"
          stroke="var(--color-importe)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
