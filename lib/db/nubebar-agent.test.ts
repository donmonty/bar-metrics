import { describe, expect, it } from "vitest";

import { applyRowCap, validateSelectOnly } from "./nubebar-agent";

/**
 * Pure unit tests (no DB) for the app-layer guardrails — issue #49's
 * single-statement/SELECT-only validator and row-cap logic, each provable
 * independently of any database connection. The fail-closed RLS /
 * cross-tenant-isolation / write-rejection behavior is covered separately by
 * `nubebar-agent.agent-db.test.ts`'s `describeIfAgentDb` integration suite.
 */
describe("validateSelectOnly", () => {
  it("accepts a plain SELECT", () => {
    expect(validateSelectOnly("SELECT * FROM core_venta")).toBeNull();
  });

  it("accepts a SELECT with leading/trailing whitespace", () => {
    expect(validateSelectOnly("  select id from core_venta  ")).toBeNull();
  });

  it("rejects a semicolon-separated multi-statement query", () => {
    const result = validateSelectOnly(
      "SELECT * FROM core_venta; SELECT * FROM core_sucursal",
    );
    expect(result?.error).toBe("rejected");
  });

  it("rejects a trailing semicolon", () => {
    const result = validateSelectOnly("SELECT * FROM core_venta;");
    expect(result?.error).toBe("rejected");
  });

  it("rejects an empty query", () => {
    expect(validateSelectOnly("   ")?.error).toBe("rejected");
  });

  it("rejects a query that doesn't start with SELECT", () => {
    expect(validateSelectOnly("EXPLAIN SELECT * FROM core_venta")?.error).toBe(
      "rejected",
    );
  });

  it.each([
    "INSERT INTO core_venta (id) VALUES (1)",
    "UPDATE core_venta SET importe = 0",
    "DELETE FROM core_venta",
    "DROP TABLE core_venta",
    "ALTER TABLE core_venta ADD COLUMN x int",
    "CREATE TABLE foo (id int)",
    "TRUNCATE core_venta",
  ])("rejects a non-SELECT statement: %s", (sql) => {
    expect(validateSelectOnly(sql)?.error).toBe("rejected");
  });

  it("does not false-positive on a forbidden word appearing inside an identifier", () => {
    expect(validateSelectOnly("SELECT created_at FROM core_venta")).toBeNull();
  });

  it.each([
    "SELECT set_config('app.sucursal_ids', '1,2,3', false) FROM core_venta",
    "WITH _ AS (SELECT set_config('app.sucursal_ids', '1,2,3', false)) SELECT * FROM core_venta",
    "SELECT current_setting('app.sucursal_ids')",
  ])("rejects a query that calls a GUC-manipulating function: %s", (sql) => {
    expect(validateSelectOnly(sql)?.error).toBe("rejected");
  });

  it.each([
    "CALL some_procedure()",
    "EXECUTE some_prepared_statement",
    "COPY core_venta TO STDOUT",
    "MERGE INTO core_venta USING x ON true WHEN MATCHED THEN DO NOTHING",
  ])("rejects a procedural/copy statement: %s", (sql) => {
    expect(validateSelectOnly(sql)?.error).toBe("rejected");
  });
});

describe("applyRowCap", () => {
  it("wraps the query in an outer-capped subquery", () => {
    expect(applyRowCap("SELECT * FROM core_venta")).toBe(
      "SELECT * FROM (SELECT * FROM core_venta) AS _capped LIMIT 100",
    );
  });

  it("caps the final result even when the inner query has its own LIMIT", () => {
    expect(applyRowCap("SELECT * FROM core_venta LIMIT 500")).toBe(
      "SELECT * FROM (SELECT * FROM core_venta LIMIT 500) AS _capped LIMIT 100",
    );
  });

  it("caps the final result of a UNION regardless of a nested LIMIT", () => {
    expect(
      applyRowCap(
        "SELECT * FROM (SELECT * FROM a LIMIT 5) t UNION ALL SELECT * FROM b",
      ),
    ).toBe(
      "SELECT * FROM (SELECT * FROM (SELECT * FROM a LIMIT 5) t UNION ALL SELECT * FROM b) AS _capped LIMIT 100",
    );
  });

  it("respects a custom cap argument", () => {
    expect(applyRowCap("SELECT * FROM core_venta", 5)).toBe(
      "SELECT * FROM (SELECT * FROM core_venta) AS _capped LIMIT 5",
    );
  });
});
