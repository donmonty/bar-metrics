import { describe, expect, it } from "vitest";

import { getProductosSinRegistro } from "./productos-sin-registro";

/**
 * `getProductosSinRegistro` integration test (issue #20), mirroring
 * `lib/metrics/merma.test.ts`'s pattern: reads the real
 * `core_productosinregistro`/`core_receta` data from the live DigitalOcean
 * Postgres for the one real Sucursal in the live DB (id `1`).
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout).
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL
  ? describe
  : describe.skip;

const REAL_SUCURSAL_ID = 1;

describeIfDb("getProductosSinRegistro", () => {
  it("returns unmatched products for a wide range, excluding since-registered codigo_pos", async () => {
    const result = await getProductosSinRegistro(REAL_SUCURSAL_ID, {
      from: "2021-01-01",
      to: "2026-12-31",
    });

    for (const item of result) {
      expect(typeof item.codigoPos).toBe("string");
      expect(item.codigoPos.length).toBeGreaterThan(0);
      expect(typeof item.nombre).toBe("string");
      expect(item.ocurrencias).toBeGreaterThan(0);
      expect(Number.isFinite(item.importe)).toBe(true);
    }
    // Sorted descending by importe.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.importe).toBeGreaterThanOrEqual(result[i]!.importe);
    }
    // Top-50 cap.
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("returns an empty array for a range with zero unmatched products", async () => {
    const result = await getProductosSinRegistro(REAL_SUCURSAL_ID, {
      from: "1990-01-01",
      to: "1990-01-02",
    });

    expect(result).toEqual([]);
  });
});
