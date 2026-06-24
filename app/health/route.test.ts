import { describe, expect, it, vi } from "vitest";

import type { AppDbHealth } from "@/lib/db/app";
import type { NubebarDbHealth } from "@/lib/db/nubebar";

// Stub both DB readouts and the auth config checks: this is a unit test of
// the route's response shape, not of real connectivity (that's
// `lib/db/app/round-trip.test.ts` and `lib/db/nubebar/read.test.ts`'s job).
// A real call would depend on whatever env happens to be present, making
// this test non-deterministic across machines/CI.
const readAppDbHealth = vi.fn<() => Promise<AppDbHealth>>();
vi.mock("@/lib/db/app", () => ({ readAppDbHealth }));

const readNubebarDbHealth = vi.fn<() => Promise<NubebarDbHealth>>();
vi.mock("@/lib/db/nubebar", () => ({ readNubebarDbHealth }));

const isAuthConfigured = vi.fn<() => boolean>();
const isResendConfigured = vi.fn<() => boolean>();
vi.mock("@/lib/auth", () => ({ isAuthConfigured, isResendConfigured }));

describe("GET /health", () => {
  it("responds 200 to confirm the app booted", async () => {
    readAppDbHealth.mockResolvedValue({ configured: false });
    readNubebarDbHealth.mockResolvedValue({ configured: false });
    isAuthConfigured.mockReturnValue(false);
    isResendConfigured.mockReturnValue(false);
    const { GET } = await import("./route");

    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns an ok status payload with the DB and auth readouts", async () => {
    readAppDbHealth.mockResolvedValue({
      configured: true,
      reachable: true,
      healthChecks: 3,
    });
    readNubebarDbHealth.mockResolvedValue({
      configured: true,
      reachable: true,
      sucursales: 12,
    });
    isAuthConfigured.mockReturnValue(true);
    isResendConfigured.mockReturnValue(true);
    const { GET } = await import("./route");

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      status: "ok",
      service: "bar-metrics",
      db: { configured: true, reachable: true, healthChecks: 3 },
      nubebar: { configured: true, reachable: true, sucursales: 12 },
      auth: { configured: true, resendConfigured: true },
    });
  });
});
