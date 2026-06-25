import { describe, expect, it } from "vitest";

import { getStockValue } from "./stock-value";

/**
 * `getStockValue` integration test (issue #18), mirroring
 * `lib/metrics/merma.test.ts`'s pattern: reads real Botella data from the
 * live DigitalOcean Postgres for the one real Sucursal in the live DB
 * (id `1`).
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout).
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL
  ? describe
  : describe.skip;

const REAL_SUCURSAL_ID = 1;

describeIfDb("getStockValue", () => {
  it("returns a non-negative total and a Barra/Bodega breakdown for the real Sucursal", async () => {
    const result = await getStockValue(REAL_SUCURSAL_ID);

    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);

    expect(result.breakdown).toHaveLength(2);
    const tipos = result.breakdown.map((item) => item.tipo).sort();
    expect(tipos).toEqual(["Barra", "Bodega"]);

    const sumOfBreakdown = result.breakdown.reduce(
      (sum, item) => sum + item.valor,
      0,
    );
    expect(sumOfBreakdown).toBeCloseTo(result.total, 5);

    for (const item of result.breakdown) {
      expect(item.valor).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns $0 for a Sucursal with no real ID match", async () => {
    const result = await getStockValue(-1);

    expect(result.total).toBe(0);
    expect(result.breakdown.every((item) => item.valor === 0)).toBe(true);
  });
});
