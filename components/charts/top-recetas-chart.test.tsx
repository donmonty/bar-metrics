/**
 * Behavior-level test for `TopRecetasChart` (issue #19) — mirrors
 * `merma-chart.test.tsx`'s pattern: asserts the prop contract, not
 * Recharts' internal rendering. Needs jsdom; `@vitest-environment`
 * overrides the project's default `node` test environment for this file
 * only.
 */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import {
  TopRecetasChart,
  type TopRecetasChartDatum,
} from "./top-recetas-chart";

function makeData(count: number): TopRecetasChartDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    receta: `Receta ${count - i}`,
    importe: count - i,
    unidades: (count - i) * 2,
  }));
}

describe("TopRecetasChart", () => {
  it("renders the named empty state when given an empty array", () => {
    render(
      <TopRecetasChart
        data={[]}
        emptyMessage="No hay ventas registradas en este periodo."
      />,
    );

    expect(
      screen.getByText("No hay ventas registradas en este periodo."),
    ).toBeInTheDocument();
  });

  it("renders bars in the given sorted order", () => {
    const data = makeData(3);
    render(<TopRecetasChart data={data} emptyMessage="vacío" />);

    const labels = [
      ...new Set(
        screen.getAllByText(/^Receta \d+$/).map((el) => el.textContent),
      ),
    ];
    expect(labels).toEqual(["Receta 3", "Receta 2", "Receta 1"]);
  });

  it("caps at top-N and expands to reveal the rest on click", () => {
    const data = makeData(5);
    render(<TopRecetasChart data={data} emptyMessage="vacío" topN={3} />);

    expect(screen.queryByText("Receta 1")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrar las 2 restantes")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mostrar las 2 restantes"));

    expect(screen.getByText("Receta 1")).toBeInTheDocument();
    expect(screen.getByText("Mostrar menos")).toBeInTheDocument();
  });

  it("does not show the expansion control when data fits within top-N", () => {
    const data = makeData(2);
    render(<TopRecetasChart data={data} emptyMessage="vacío" topN={3} />);

    expect(screen.queryByText(/Mostrar/)).not.toBeInTheDocument();
  });
});
