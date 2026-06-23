import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /health", () => {
  it("responds 200 to confirm the app booted", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns an ok status payload with an app-DB readout", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.service).toBe("bar-metrics");
    // Without DB env vars (unit-test/CI default) the readout reports the DB as
    // not configured rather than attempting a connection or failing.
    expect(body.db).toEqual({ configured: false });
  });
});
