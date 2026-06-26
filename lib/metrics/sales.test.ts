import { describe, expect, it } from "vitest";

import { getSalesSummary } from "./sales";

/**
 * `getSalesSummary` integration test (issue #19), mirroring
 * `lib/metrics/merma.test.ts`'s pattern: reads the real Venta data from the
 * live DigitalOcean Postgres for the one real Sucursal in the live DB
 * (id `1`).
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout).
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL
  ? describe
  : describe.skip;

const REAL_SUCURSAL_ID = 1;

describeIfDb("getSalesSummary", () => {
  it("returns daily revenue + top Recetas for a range with real Ventas", async () => {
    const result = await getSalesSummary(REAL_SUCURSAL_ID, {
      from: "2021-01-01",
      to: "2026-12-31",
    });

    expect(result.dailyRevenue.length).toBeGreaterThan(0);
    expect(result.topRecetas.length).toBeGreaterThan(0);

    for (const point of result.dailyRevenue) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(point.fecha)).toBe(true);
      expect(Number.isFinite(point.importe)).toBe(true);
    }
    // Sorted ascending by fecha.
    for (let i = 1; i < result.dailyRevenue.length; i++) {
      expect(
        result.dailyRevenue[i - 1]!.fecha <= result.dailyRevenue[i]!.fecha,
      ).toBe(true);
    }

    for (const item of result.topRecetas) {
      expect(typeof item.receta).toBe("string");
      expect(item.receta.length).toBeGreaterThan(0);
      expect(Number.isFinite(item.importe)).toBe(true);
      expect(Number.isFinite(item.unidades)).toBe(true);
    }
    // Sorted descending by importe.
    for (let i = 1; i < result.topRecetas.length; i++) {
      expect(result.topRecetas[i - 1]!.importe).toBeGreaterThanOrEqual(
        result.topRecetas[i]!.importe,
      );
    }
  });

  it("returns empty series for a range with zero Ventas", async () => {
    const result = await getSalesSummary(REAL_SUCURSAL_ID, {
      from: "1990-01-01",
      to: "1990-01-02",
    });

    expect(result.dailyRevenue).toEqual([]);
    expect(result.topRecetas).toEqual([]);
  });
});
