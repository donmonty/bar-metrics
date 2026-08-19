/**
 * Shared chart module: the repo's chart conventions (issue #23) plus the
 * bar-chart sizing helper they mandate. Read this before building a metric
 * chart. The conventions lived in `ranked-bar-chart.tsx`'s header until issue
 * #70 deleted that POC component along with the `dev-chart-poc` route that was
 * its only call site; they moved here because every chart already imports this
 * file, so the doc stays in the path of anyone writing one.
 *
 * This file is hand-written and `shadcn` never touches it — which is exactly
 * why the conventions live here rather than in `components/ui/chart.tsx`. The
 * flip side is that a `shadcn add chart` can restore the registry chart file
 * and leave this doc describing behaviour the code no longer has: conventions
 * 1 and 2 below depend on two deliberate edits in `components/ui/chart.tsx`
 * (the `--chart-grid` grid stroke and the `--popover` tooltip surface), which
 * that file's header names. See the shadcn guard in `app/globals.css`.
 *
 * 1. Theming: build on shadcn's `ChartContainer` + a `ChartConfig` (see
 *    `components/ui/chart.tsx`). Don't configure Recharts colors/fonts by
 *    hand — `ChartContainer` injects `--color-<key>` CSS vars per series
 *    from the config, and Recharts elements reference them via
 *    `fill="var(--color-<key>)"`. `--chart-1..5` in `app/globals.css` are
 *    the Ember ramp (issue #63): one orange hue, five steps ASCENDING in
 *    lightness on a near-black card. Two rules come with it —
 *      - A single-series chart uses `--chart-3`, the step that is the brand
 *        accent itself, not `--chart-1`. The ramp is an ordered lightness
 *        scale, so the accent sits in its middle.
 *      - Ranked bars stay FLAT. Every bar in a ranked chart takes the same
 *        step; #63 decided a bar's colour should not encode its rank when
 *        its length already does. The ramp is there for multi-series charts,
 *        not for indexing per row.
 *    Every step clears 3:1 against `--card` and `--background`, and there is
 *    a hard lightness floor around L 0.51 below which an orange fill cannot
 *    — don't darken a step to make it "recede".
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
 *    wrapped label. Use `getChartHeightPx(visibleRowCount)` below, which
 *    sizes height off the number of bars actually rendered (a per-row
 *    minimum tall enough for a wrapped 2-line label), and
 *    `CHART_Y_AXIS_WIDTH_PX` for the `YAxis`'s `width`.
 * 5. Loading skeleton: export a sibling `<Thing>Skeleton` component sized
 *    with the same `getChartHeightPx` call the real component would use for
 *    its expected row count (e.g. the top-N default) using shadcn's
 *    `<Skeleton>`. Pages render the skeleton while fetching, then swap to
 *    the real component once data resolves — don't build loading state into
 *    the chart component itself.
 */
export const CHART_ROW_HEIGHT_PX = 40;
export const CHART_MIN_HEIGHT_PX = 160;
export const CHART_Y_AXIS_WIDTH_PX = 120;

/** Height (px) for a chart showing `rowCount` bars, never below the minimum. */
export function getChartHeightPx(rowCount: number): number {
  return Math.max(CHART_MIN_HEIGHT_PX, rowCount * CHART_ROW_HEIGHT_PX);
}
