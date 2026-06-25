import { describe, expect, it } from "vitest";

import { getMermaOverview } from "./merma";

/**
 * `getMermaOverview` integration test (issue #17), mirroring
 * `lib/db/nubebar/read.test.ts`'s pattern: reads the real merma data (see
 * `docs/CONTEXT.md`) from the live DigitalOcean Postgres for the one real
 * Sucursal in the live DB (id `1`).
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout).
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL
  ? describe
  : describe.skip;

const REAL_SUCURSAL_ID = 1;

describeIfDb("getMermaOverview", () => {
  it("returns merma % + delta per Ingrediente for a range with real Inspecciones", async () => {
    const result = await getMermaOverview(REAL_SUCURSAL_ID, {
      from: "2021-01-01",
      to: "2026-12-31",
    });

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(typeof item.ingrediente).toBe("string");
      expect(item.ingrediente.length).toBeGreaterThan(0);
      expect(Number.isFinite(item.porcentaje)).toBe(true);
      expect(Number.isFinite(item.deltaMl)).toBe(true);
    }

    // Sorted descending by % variance.
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i - 1]!.porcentaje).toBeGreaterThanOrEqual(
        result.items[i]!.porcentaje,
      );
    }
  });

  it("returns an empty result for a range with zero Inspecciones", async () => {
    const result = await getMermaOverview(REAL_SUCURSAL_ID, {
      from: "1990-01-01",
      to: "1990-01-02",
    });

    expect(result.items).toEqual([]);
  });
});
