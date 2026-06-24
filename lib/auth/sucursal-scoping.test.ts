import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assignSucursales, auth } from "./index";
import { getAppDb } from "@/lib/db/app";
import { findExistingSucursalIds } from "@/lib/db/nubebar";

type AppDb = ReturnType<typeof getAppDb>;

/**
 * `lib/auth.assignSucursales` + session-callback integration test (issue
 * #12): exercises the real seam against the live Neon app DB and the live
 * nubebar read model, mirroring `lib/auth/round-trip.test.ts`'s harness
 * shape. Resend env is NOT required (per the PRD's testing notes) — only
 * `DATABASE_URL`, `AUTH_SECRET`, and `NUBEBAR_DATABASE_URL` (to validate
 * Sucursal IDs against the live nubebar data).
 *
 * SKIPPED when those env vars are absent. Every row created here is deleted
 * in `afterAll`.
 */
const describeIfConfigured =
  process.env.DATABASE_URL &&
  process.env.AUTH_SECRET &&
  process.env.NUBEBAR_DATABASE_URL
    ? describe
    : describe.skip;

describeIfConfigured("lib/auth Sucursal scoping", () => {
  let db: AppDb;
  let realSucursalIds: number[];
  const createdEmails: string[] = [];

  beforeAll(async () => {
    db = getAppDb();
    // Probe the live nubebar read model for a real Sucursal ID to assign —
    // this slice deliberately validates against real data, not fixtures.
    // (The live data currently has exactly one Sucursal — see project
    // memory — so re-assignment below is exercised via assign/un-assign of
    // that single real ID, rather than swapping between two real IDs.)
    realSucursalIds = await findExistingSucursalIds(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
    if (realSucursalIds.length < 1) {
      throw new Error(
        "This test needs at least 1 real Sucursal ID (1-50) in the " +
          "nubebar read model — none found.",
      );
    }
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      // `onDelete: Cascade` on UserSucursal.user removes the matching rows.
      await db.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await db.$disconnect();
  });

  /** Same request-shaping helper `round-trip.test.ts` uses. */
  async function resolveSessionFor(cookie: string) {
    const req = {
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
        cookie,
      },
    } as unknown as NextApiRequest;
    const res = { headers: new Headers() } as unknown as NextApiResponse;
    return auth(req, res);
  }

  async function sessionCookieFor(userId: string, email: string) {
    const sessionToken = await encode({
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
      token: { sub: userId, email, name: null, picture: null },
    });
    return `authjs.session-token=${sessionToken}`;
  }

  it("rejects a non-existent Sucursal ID before writing any rows", async () => {
    const email = `assign-invalid-${Date.now()}@example.com`;
    const bogusId = -1; // Sucursal IDs are positive; this never exists.

    await expect(assignSucursales(email, [bogusId])).rejects.toThrow();

    // No User row should have been created — the validation runs first.
    const user = await db.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it(
    "assigns, re-assigns, and is idempotent — the next Session reflects " +
      "each change",
    async () => {
      const email = `assign-sucursales-${Date.now()}@example.com`;
      createdEmails.push(email);
      const sucursalId = realSucursalIds[0]!;

      // Pre-creates the User row (the email hasn't signed in yet).
      await assignSucursales(email, [sucursalId]);
      const user = await db.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();

      let session = await resolveSessionFor(
        await sessionCookieFor(user!.id, email),
      );
      expect(session?.user?.sucursalIds).toEqual([sucursalId]);

      // Calling again with the same set is a no-op — no duplicate rows.
      await assignSucursales(email, [sucursalId]);
      const rowsAfterNoop = await db.userSucursal.findMany({
        where: { userId: user!.id },
      });
      expect(rowsAfterNoop).toHaveLength(1);

      // Re-assigning to a different set (here, the empty set) replaces it —
      // delete-missing/insert-new semantics — and the next Session reflects
      // it immediately, with no new sign-in required.
      await assignSucursales(email, []);
      session = await resolveSessionFor(
        await sessionCookieFor(user!.id, email),
      );
      expect(session?.user?.sucursalIds).toEqual([]);

      // And assigning it back confirms the replace works in both directions.
      await assignSucursales(email, [sucursalId]);
      session = await resolveSessionFor(
        await sessionCookieFor(user!.id, email),
      );
      expect(session?.user?.sucursalIds).toEqual([sucursalId]);
    },
  );

  it("returns null for an unauthenticated request", async () => {
    const req = {
      headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
    } as unknown as NextApiRequest;
    const res = { headers: new Headers() } as unknown as NextApiResponse;
    const session = await auth(req, res);
    expect(session).toBeNull();
  });
});
