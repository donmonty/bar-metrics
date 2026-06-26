/**
 * Behavior-level test for `SalesTrendChart` (issue #19) — mirrors
 * `merma-chart.test.tsx`'s pattern. Needs jsdom; `@vitest-environment`
 * overrides the project's default `node` test environment for this file
 * only.
 */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import {
  SalesTrendChart,
  type SalesTrendChartDatum,
} from "./sales-trend-chart";

function makeData(): SalesTrendChartDatum[] {
  return [
    { fecha: "2026-01-01", importe: 100 },
    { fecha: "2026-01-02", importe: 200 },
    { fecha: "2026-01-03", importe: 150 },
  ];
}

describe("SalesTrendChart", () => {
  it("renders the named empty state when given an empty array", () => {
    render(
      <SalesTrendChart
        data={[]}
        emptyMessage="No hay ventas registradas en este periodo."
      />,
    );

    expect(
      screen.getByText("No hay ventas registradas en este periodo."),
    ).toBeInTheDocument();
  });

  it("renders the date ticks for the given data", () => {
    const data = makeData();
    render(<SalesTrendChart data={data} emptyMessage="vacío" />);

    for (const point of data) {
      expect(screen.getAllByText(point.fecha).length).toBeGreaterThan(0);
    }
  });
});
