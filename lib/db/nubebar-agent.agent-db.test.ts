import { describe, expect, it } from "vitest";

import { runNubebarAgentQuery } from "./nubebar-agent";

/**
 * `runNubebarAgentQuery` integration tests (issue #49) — re-asserts the
 * security contract `lib/db/nubebar/agent-rls.test.ts` already proves at the
 * `nubebar_agent` role level, this time *through* the new connection seam:
 * fresh-client connect, `statement_timeout`, `set_config('app.sucursal_ids',
 * ...)`, and teardown all happen inside `runNubebarAgentQuery` itself, not
 * driven by the test directly.
 *
 * SKIPPED when `NUBEBAR_AGENT_DATABASE_URL` is absent, mirroring
 * `agent-rls.test.ts`'s gating convention.
 *
 * The live DB has exactly one real Sucursal (id 1); the synthetic id 999
 * stands in for "a Sucursal this caller is not scoped to."
 */
const connectionString = process.env.NUBEBAR_AGENT_DATABASE_URL;
const describeIfAgentDb = connectionString ? describe : describe.skip;

describeIfAgentDb("runNubebarAgentQuery", () => {
  it("returns rows for the real Sucursal it's scoped to", async () => {
    const result = await runNubebarAgentQuery(
      [1],
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(result).not.toHaveProperty("error");
    expect("rows" in result && result.rows[0]?.count).toBeGreaterThan(0);
  });

  it("returns zero rows for a synthetic Sucursal that doesn't exist (cross-tenant isolation)", async () => {
    const result = await runNubebarAgentQuery(
      [999],
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(result).not.toHaveProperty("error");
    expect("rows" in result && result.rows[0]?.count).toBe(0);
  });

  it("returns zero rows when the Sucursal scope is empty (fail-closed)", async () => {
    const result = await runNubebarAgentQuery(
      [],
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(result).not.toHaveProperty("error");
    expect("rows" in result && result.rows[0]?.count).toBe(0);
  });

  it("sees the real Sucursal's rows and none of a synthetic one's, when scoped to both", async () => {
    const result = await runNubebarAgentQuery(
      [1, 999],
      "SELECT DISTINCT sucursal_id FROM core_venta",
    );
    expect(result).not.toHaveProperty("error");
    const sucursalIds =
      "rows" in result ? result.rows.map((r) => r.sucursal_id) : [];
    expect(sucursalIds).toContain(1);
    expect(sucursalIds).not.toContain(999);
  });

  it("caps results at 100 rows even when the query's own LIMIT is higher", async () => {
    const result = await runNubebarAgentQuery(
      [1],
      "SELECT * FROM core_venta LIMIT 100000",
    );
    expect(result).not.toHaveProperty("error");
    expect("rows" in result && result.rows.length).toBeLessThanOrEqual(100);
  });

  it("caps a UNION's total rows even though only a nested subquery has a LIMIT", async () => {
    const result = await runNubebarAgentQuery(
      [1],
      "SELECT * FROM (SELECT * FROM core_venta LIMIT 5) t UNION ALL SELECT * FROM core_venta",
    );
    expect(result).not.toHaveProperty("error");
    expect("rows" in result && result.rows.length).toBeLessThanOrEqual(100);
  });

  it("rejects a query that tries to override app.sucursal_ids via set_config", async () => {
    const result = await runNubebarAgentQuery(
      [999],
      "WITH _ AS (SELECT set_config('app.sucursal_ids', '1', false)) SELECT * FROM core_venta",
    );
    expect(result).toMatchObject({ error: "rejected" });
  });

  it("rejects a write attempt at the app layer before touching the DB", async () => {
    const result = await runNubebarAgentQuery(
      [1],
      "INSERT INTO core_venta (fecha, unidades, importe, caja_id, receta_id, sucursal_id) VALUES (now(), 1, 1, 1, 1, 1)",
    );
    expect(result).toEqual({
      error: "rejected",
      message: "Only SELECT statements are allowed.",
    });
  });

  it("rejects a multi-statement input before touching the DB", async () => {
    const result = await runNubebarAgentQuery(
      [1],
      "SELECT 1; DROP TABLE core_venta",
    );
    expect(result).toMatchObject({ error: "rejected" });
  });
});
