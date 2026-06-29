import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Structured-error path for `runNubebarAgentQuery` (issue #49), mirroring
 * `lib/chat/tools.test.ts`'s `vi.doMock`-based pattern: mocks `pg.Client` so
 * a DB-level failure (connection refused, statement timeout, etc.) is
 * exercised without a real database, asserting it surfaces as a structured
 * `{ error: "db_error", message }` rather than throwing.
 */
describe("runNubebarAgentQuery error path", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("pg");
    delete process.env.NUBEBAR_AGENT_DATABASE_URL;
  });

  it("returns a structured db_error instead of throwing when the connection fails", async () => {
    vi.doMock("pg", () => ({
      Client: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error("connection refused")),
        query: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      })),
    }));
    process.env.NUBEBAR_AGENT_DATABASE_URL = "postgres://fake";

    const { runNubebarAgentQuery } = await import("./nubebar-agent");
    const result = await runNubebarAgentQuery([1], "SELECT 1");

    expect(result).toEqual({
      error: "db_error",
      message: "connection refused",
    });
  });

  it("returns a structured db_error when the statement times out", async () => {
    vi.doMock("pg", () => ({
      Client: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi
          .fn()
          .mockRejectedValue(
            new Error("canceling statement due to statement timeout"),
          ),
        end: vi.fn().mockResolvedValue(undefined),
      })),
    }));
    process.env.NUBEBAR_AGENT_DATABASE_URL = "postgres://fake";

    const { runNubebarAgentQuery } = await import("./nubebar-agent");
    const result = await runNubebarAgentQuery([1], "SELECT 1");

    expect(result).toEqual({
      error: "db_error",
      message: "canceling statement due to statement timeout",
    });
  });

  it("always closes the connection, even when the query fails", async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    vi.doMock("pg", () => ({
      Client: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockRejectedValue(new Error("boom")),
        end,
      })),
    }));
    process.env.NUBEBAR_AGENT_DATABASE_URL = "postgres://fake";

    const { runNubebarAgentQuery } = await import("./nubebar-agent");
    await runNubebarAgentQuery([1], "SELECT 1");

    expect(end).toHaveBeenCalledTimes(1);
  });
});
