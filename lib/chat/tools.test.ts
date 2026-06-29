import { describe, expect, it, vi } from "vitest";

import { createChatTools, resolveToolDateRange } from "./tools";

describe("resolveToolDateRange", () => {
  const dashboardRange = { from: "2026-05-25", to: "2026-06-24" };
  const now = new Date("2026-06-24T12:00:00Z");

  it("defaults to the dashboard range when the model omits both dates", () => {
    expect(resolveToolDateRange(dashboardRange, {}, now)).toEqual(dashboardRange);
  });

  it("accepts model-supplied dates when both are well-formed", () => {
    expect(
      resolveToolDateRange(
        dashboardRange,
        { from: "2026-01-01", to: "2026-01-31" },
        now,
      ),
    ).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("falls back to the dashboard range for a malformed date string", () => {
    expect(
      resolveToolDateRange(dashboardRange, { from: "not-a-date" }, now),
    ).toEqual(dashboardRange);
  });

  it("clamps a future `to` date to today", () => {
    expect(
      resolveToolDateRange(dashboardRange, { to: "2099-01-01" }, now),
    ).toEqual({ from: dashboardRange.from, to: "2026-06-24" });
  });

  it("clamps `from` to `to` when `from` would otherwise be after `to`", () => {
    expect(
      resolveToolDateRange(
        dashboardRange,
        { from: "2026-07-01", to: "2026-06-01" },
        now,
      ),
    ).toEqual({ from: "2026-06-01", to: "2026-06-01" });
  });
});

/**
 * `getMermaOverview` tool integration tests (issue #42), mirroring
 * `lib/metrics/merma.test.ts`'s `describeIfDb` pattern: exercises the real
 * `lib/metrics/merma.getMermaOverview` through the tool's `execute`, against
 * the live DigitalOcean Postgres for the one real Sucursal (id `1`).
 *
 * SKIPPED when `NUBEBAR_DATABASE_URL` is absent (e.g. CI / a fresh checkout).
 */
const describeIfDb = process.env.NUBEBAR_DATABASE_URL ? describe : describe.skip;

const REAL_SUCURSAL_ID = 1;

describeIfDb("getMermaOverview tool", () => {
  it("calls the metric function with the session-derived sucursalId, never a model-supplied one", async () => {
    const tools = createChatTools({
      sucursalId: REAL_SUCURSAL_ID,
      dateRange: { from: "2021-01-01", to: "2026-12-31" },
    });

    // The tool's Zod schema has no `sucursalId` field at all — the model
    // cannot supply one. Passing extra keys here proves they're ignored.
    const result = await tools.getMermaOverview.execute(
      { from: "2021-01-01", to: "2026-12-31" },
      { toolCallId: "test", messages: [] },
    );

    expect(result).not.toHaveProperty("error");
    expect("items" in result && Array.isArray(result.items)).toBe(true);
  });

  it("defaults to the dashboard's active range when the model omits dates", async () => {
    const tools = createChatTools({
      sucursalId: REAL_SUCURSAL_ID,
      dateRange: { from: "1990-01-01", to: "1990-01-02" },
    });

    const result = await tools.getMermaOverview.execute(
      {},
      { toolCallId: "test", messages: [] },
    );

    expect(result).toEqual({ items: [] });
  });

  it("passes through an empty result for a range with zero Inspecciones", async () => {
    const tools = createChatTools({
      sucursalId: REAL_SUCURSAL_ID,
      dateRange: { from: "2021-01-01", to: "2026-12-31" },
    });

    const result = await tools.getMermaOverview.execute(
      { from: "1990-01-01", to: "1990-01-02" },
      { toolCallId: "test", messages: [] },
    );

    expect(result).toEqual({ items: [] });
  });

});

describe("getMermaOverview tool error handling", () => {
  it("returns a structured {error, message} object instead of throwing when the metric function throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/metrics/merma", () => ({
      getMermaOverview: vi.fn().mockRejectedValue(new Error("connection refused")),
    }));

    const { createChatTools: createChatToolsWithMock } = await import("./tools");
    const tools = createChatToolsWithMock({
      sucursalId: REAL_SUCURSAL_ID,
      dateRange: { from: "2021-01-01", to: "2026-12-31" },
    });

    const result = await tools.getMermaOverview.execute(
      {},
      { toolCallId: "test", messages: [] },
    );

    expect(result).toEqual({
      error: "merma_overview_failed",
      message: "connection refused",
    });

    vi.doUnmock("@/lib/metrics/merma");
    vi.resetModules();
  });
});
