/**
 * Behavior-level test for `ProductosSinRegistroTable` (issue #20) — asserts
 * the prop contract: rows render in the order given, with correct content,
 * and the named empty state replaces the table shell when `data` is empty.
 */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { ProductosSinRegistroTable } from "./productos-sin-registro-table";

describe("ProductosSinRegistroTable", () => {
  it("renders rows in the given order with correct content", () => {
    render(
      <ProductosSinRegistroTable
        data={[
          { codigoPos: "P001", nombre: "Mezcal Raro", ocurrencias: 5, importe: 1200 },
          { codigoPos: "P002", nombre: "Tequila Misc", ocurrencias: 2, importe: 300 },
        ]}
        emptyMessage="No hay productos sin registro en este periodo."
      />,
    );

    const rows = screen.getAllByRole("row");
    // Header row + 2 data rows.
    expect(rows).toHaveLength(3);
    expect(screen.getByText("P001")).toBeInTheDocument();
    expect(screen.getByText("Mezcal Raro")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("P002")).toBeInTheDocument();
    expect(screen.getByText("$300")).toBeInTheDocument();

    // Order preserved: P001's row comes before P002's row.
    const p001Index = rows.findIndex((row) => row.textContent?.includes("P001"));
    const p002Index = rows.findIndex((row) => row.textContent?.includes("P002"));
    expect(p001Index).toBeLessThan(p002Index);
  });

  it("renders the named empty message instead of a table when data is empty", () => {
    render(
      <ProductosSinRegistroTable
        data={[]}
        emptyMessage="No hay productos sin registro en este periodo."
      />,
    );

    expect(
      screen.getByText("No hay productos sin registro en este periodo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
