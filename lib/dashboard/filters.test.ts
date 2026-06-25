import { describe, expect, it } from "vitest";

import { resolveDateRange, resolveSucursalId } from "./filters";

describe("resolveSucursalId", () => {
  it("falls back to the first assigned Sucursal when nothing is requested", () => {
    expect(resolveSucursalId([3, 7], undefined)).toBe(3);
  });

  it("accepts a requested ID that is in the session's allowed list", () => {
    expect(resolveSucursalId([3, 7], "7")).toBe(7);
  });

  it("never trusts a requested ID outside the session's allowed list", () => {
    expect(resolveSucursalId([3, 7], "999")).toBe(3);
  });

  it("rejects a non-numeric requested value", () => {
    expect(resolveSucursalId([3, 7], "not-a-number")).toBe(3);
  });

  it("returns null for a User with zero assigned Sucursales", () => {
    expect(resolveSucursalId([], "3")).toBeNull();
  });
});

describe("resolveDateRange", () => {
  const now = new Date("2026-06-24T12:00:00Z");

  it("defaults to the Last 30 days preset with no params", () => {
    const range = resolveDateRange({ now });
    expect(range).toEqual({
      kind: "preset",
      preset: "last30",
      from: "2026-05-25",
      to: "2026-06-24",
    });
  });

  it("resolves a recognized preset key", () => {
    const range = resolveDateRange({ range: "last7", now });
    expect(range).toEqual({
      kind: "preset",
      preset: "last7",
      from: "2026-06-17",
      to: "2026-06-24",
    });
  });

  it("falls back to the default preset for an unrecognized range key", () => {
    const range = resolveDateRange({ range: "last3000", now });
    expect(range.kind).toBe("preset");
    expect((range as { preset: string }).preset).toBe("last30");
  });

  it("prefers an explicit valid custom from/to pair over any preset", () => {
    const range = resolveDateRange({
      range: "last7",
      from: "2026-01-01",
      to: "2026-01-15",
      now,
    });
    expect(range).toEqual({
      kind: "custom",
      from: "2026-01-01",
      to: "2026-01-15",
    });
  });

  it("falls back to the default preset when from is after to", () => {
    const range = resolveDateRange({
      from: "2026-02-01",
      to: "2026-01-01",
      now,
    });
    expect(range.kind).toBe("preset");
  });

  it("falls back to the default preset when from/to are malformed", () => {
    const range = resolveDateRange({ from: "not-a-date", to: "2026-01-01", now });
    expect(range.kind).toBe("preset");
  });
});
