/**
 * Shared bar-chart sizing helper (chart-styling fix, issue #17/#23) — every
 * horizontal ranked-bar chart in this repo computes its `ChartContainer`
 * height from the number of *visible* rows via `getChartHeightPx`, instead
 * of a fixed height. A fixed height divided across N bars made each bar's
 * row slot too thin once N grew past a handful, and Recharts' `YAxis`
 * auto-wraps a category label onto two lines when it doesn't fit `width` —
 * with a too-thin row slot, the wrapped label visually collides with
 * neighboring bars. Driving height off row count keeps each row tall enough
 * for a wrapped 2-line label regardless of how many bars are shown.
 */
export const CHART_ROW_HEIGHT_PX = 40;
export const CHART_MIN_HEIGHT_PX = 160;
export const CHART_Y_AXIS_WIDTH_PX = 120;

/** Height (px) for a chart showing `rowCount` bars, never below the minimum. */
export function getChartHeightPx(rowCount: number): number {
  return Math.max(CHART_MIN_HEIGHT_PX, rowCount * CHART_ROW_HEIGHT_PX);
}
