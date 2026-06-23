import { describe, expect, it } from "vitest";

import { countSucursales } from "./index";

/**
 * nubebar read-model integration test (issue #5): reads a real glossary
 * entity (Sucursal — see `docs/CONTEXT.md`) from the live DigitalOcean
 * Postgres and asserts a plausible row count. This is the project's
 * tie-breaker requirement: the read model must be proven against real data,
 * not a fabricated schema.
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout
 * before the connection pool is provisioned). Type-check and unit tests still
 * pass in that state.
 *
 * To run it: create the DigitalOcean Connection Pool (README -> Environment),
 * set `NUBEBAR_DATABASE_URL` in `.env.local`, then `npm test`. This seam is
 * read-only by construction — there is no write path to clean up afterward.
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL ? describe : describe.skip;

describeIfDb("nubebar read model", () => {
  it("counts Sucursales from the live nubebar DB", async () => {
    const sucursales = await countSucursales();

    expect(sucursales).toBeGreaterThan(0);
  });
});
