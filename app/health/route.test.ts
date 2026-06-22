import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /health", () => {
  it("responds 200 to confirm the app booted", () => {
    const res = GET();
    expect(res.status).toBe(200);
  });

  it("returns an ok status payload with no database access", async () => {
    const res = GET();
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      service: "bar-metrics",
    });
  });
});
