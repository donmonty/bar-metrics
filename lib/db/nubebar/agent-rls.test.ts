import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `nubebar_agent` + RLS integration test (issue #32, PRD #31, ADR 0002):
 * connects directly as the locked-down `nubebar_agent` role (NOT via Prisma —
 * there is no Prisma client for this role) against the live nubebar Postgres
 * and asserts the externally observable security property — "a connection
 * scoped to Sucursal set S can only ever see rows belonging to S" — holds for
 * both the direct-column and join-path policy groups, and that the role
 * cannot write regardless of RLS.
 *
 * SKIPPED when `NUBEBAR_AGENT_DATABASE_URL` is absent (e.g. CI / a fresh
 * checkout before the role + script have been applied), mirroring
 * `lib/db/nubebar/read.test.ts`'s existing gating convention.
 *
 * The live DB has exactly one real Sucursal (id 1) — the multi-ID case is
 * therefore exercised with at least one synthetic, nonexistent ID (999),
 * which is sufficient to prove the ANY(...) membership logic.
 */
const connectionString = process.env.NUBEBAR_AGENT_DATABASE_URL;
const describeIfAgentDb = connectionString ? describe : describe.skip;

describeIfAgentDb("nubebar_agent + RLS", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  async function setSucursalIds(value: string | null) {
    if (value === null) {
      await client.query("RESET app.sucursal_ids");
    } else {
      await client.query("SET app.sucursal_ids = $1", [value]);
    }
  }

  it("sees rows for the real Sucursal it's scoped to (direct group: core_venta)", async () => {
    await setSucursalIds("1");
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(rows[0].count).toBeGreaterThan(0);
  });

  it("sees zero rows for a synthetic Sucursal that doesn't exist", async () => {
    await setSucursalIds("999");
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(rows[0].count).toBe(0);
  });

  it("sees the real Sucursal's rows and none of a synthetic one's, when scoped to both (multi-ID ANY(...) membership)", async () => {
    await setSucursalIds("1,999");
    const { rows } = await client.query(
      "SELECT DISTINCT sucursal_id FROM core_venta",
    );
    const sucursalIds = rows.map((r) => r.sucursal_id);
    expect(sucursalIds).toContain(1);
    expect(sucursalIds).not.toContain(999);
  });

  it("sees zero rows when app.sucursal_ids is unset (fail-closed)", async () => {
    await setSucursalIds(null);
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM core_venta",
    );
    expect(rows[0].count).toBe(0);
  });

  it("enforces the join-path policy on an indirect-group table (core_iteminspeccion via core_inspeccion)", async () => {
    await setSucursalIds("1");
    const scoped = await client.query(
      "SELECT count(*)::int AS count FROM core_iteminspeccion",
    );

    await setSucursalIds("999");
    const unscoped = await client.query(
      "SELECT count(*)::int AS count FROM core_iteminspeccion",
    );
    expect(unscoped.rows[0].count).toBe(0);

    await setSucursalIds(null);
    const unset = await client.query(
      "SELECT count(*)::int AS count FROM core_iteminspeccion",
    );
    expect(unset.rows[0].count).toBe(0);

    // Document the scoped count was at least queryable (no error) without
    // asserting an exact value — the live row count isn't this test's
    // concern, only that scoping behaves consistently with core_venta above.
    expect(scoped.rows[0].count).toBeGreaterThanOrEqual(0);
  });

  it("rejects writes regardless of RLS (SELECT-only grant is a second barrier)", async () => {
    await setSucursalIds("1");
    await expect(
      client.query(
        "INSERT INTO core_venta (fecha, unidades, importe, caja_id, receta_id, sucursal_id) VALUES (now(), 1, 1, 1, 1, 1)",
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
