/**
 * Behavior-level test for `MermaChart` (issue #17) — asserts the prop
 * contract, not Recharts' internal rendering: sort order is passed through
 * as given (the chart trusts the caller's order, mirroring #23's POC), the
 * top-N cap + expansion control works, and the named empty state renders for
 * an empty array. Needs jsdom; `@vitest-environment` overrides the project's
 * default `node` test environment for this file only.
 */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// `@testing-library/react`'s auto-cleanup registers via the Jest-style
// global `afterEach`, which this project doesn't enable (no `test.globals`
// in vitest.config.ts) — without this, DOM from one test leaks into the
// next test's `document`.
afterEach(cleanup);

import { MermaChart, type MermaChartDatum } from "./merma-chart";

function makeData(count: number): MermaChartDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    ingrediente: `Ingrediente ${count - i}`,
    porcentaje: count - i,
    deltaMl: (count - i) * 10,
  }));
}

describe("MermaChart", () => {
  it("renders the named empty state when given an empty array", () => {
    render(<MermaChart data={[]} emptyMessage="No hay inspecciones." />);

    expect(screen.getByText("No hay inspecciones.")).toBeInTheDocument();
  });

  it("renders bars in the given sorted order", () => {
    const data = makeData(3);
    render(<MermaChart data={data} emptyMessage="vacío" />);

    // Recharts' YAxis renders each tick label via more than one internal
    // element in jsdom (no real layout to dedupe against); collapse
    // consecutive duplicates rather than asserting on the raw DOM node count.
    const labels = [
      ...new Set(
        screen.getAllByText(/^Ingrediente \d+$/).map((el) => el.textContent),
      ),
    ];
    expect(labels).toEqual(["Ingrediente 3", "Ingrediente 2", "Ingrediente 1"]);
  });

  it("caps at top-N and expands to reveal the rest on click", () => {
    const data = makeData(5);
    render(<MermaChart data={data} emptyMessage="vacío" topN={3} />);

    expect(screen.queryByText("Ingrediente 1")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrar los 2 restantes")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mostrar los 2 restantes"));

    expect(screen.getByText("Ingrediente 1")).toBeInTheDocument();
    expect(screen.getByText("Mostrar menos")).toBeInTheDocument();
  });

  it("does not show the expansion control when data fits within top-N", () => {
    const data = makeData(2);
    render(<MermaChart data={data} emptyMessage="vacío" topN={3} />);

    expect(screen.queryByText(/Mostrar/)).not.toBeInTheDocument();
  });
});
