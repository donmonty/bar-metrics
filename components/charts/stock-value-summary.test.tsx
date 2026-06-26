/**
 * Behavior-level test for `StockValueSummary` (issue #18) — asserts the
 * prop contract: the big number and Barra/Bodega breakdown render given a
 * DTO, including the zero-value case (no distinct empty-state message per
 * the issue, just $0 rendered plainly).
 */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { StockValueSummary } from "./stock-value-summary";

describe("StockValueSummary", () => {
  it("renders the total and per-Almacén breakdown", () => {
    render(
      <StockValueSummary
        total={97573}
        breakdown={[
          { tipo: "Barra", valor: 97573 },
          { tipo: "Bodega", valor: 0 },
        ]}
      />,
    );

    expect(screen.getAllByText("$97,573")).toHaveLength(2);
    expect(screen.getByText("Barra")).toBeInTheDocument();
    expect(screen.getByText("Bodega")).toBeInTheDocument();
    expect(screen.getAllByText("$0")).toHaveLength(1);
  });

  it("renders $0 plainly for a Sucursal with zero Botellas, no separate empty state", () => {
    render(
      <StockValueSummary
        total={0}
        breakdown={[
          { tipo: "Barra", valor: 0 },
          { tipo: "Bodega", valor: 0 },
        ]}
      />,
    );

    expect(screen.getAllByText("$0")).toHaveLength(3);
  });
});
