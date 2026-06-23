import { describe, expect, it, vi } from "vitest";

import type { AppDbHealth } from "@/lib/db/app";

// Stub the app-DB readout: this is a unit test of the route's response shape,
// not of real connectivity (that's `lib/db/app/round-trip.test.ts`'s job). A
// real call would depend on whatever DATABASE_URL happens to be in the
// environment, making this test non-deterministic across machines/CI.
const readAppDbHealth = vi.fn<() => Promise<AppDbHealth>>();
vi.mock("@/lib/db/app", () => ({ readAppDbHealth }));

describe("GET /health", () => {
  it("responds 200 to confirm the app booted", async () => {
    readAppDbHealth.mockResolvedValue({ configured: false });
    const { GET } = await import("./route");

    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns an ok status payload with the app-DB readout", async () => {
    readAppDbHealth.mockResolvedValue({
      configured: true,
      reachable: true,
      healthChecks: 3,
    });
    const { GET } = await import("./route");

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      status: "ok",
      service: "bar-metrics",
      db: { configured: true, reachable: true, healthChecks: 3 },
    });
  });
});
