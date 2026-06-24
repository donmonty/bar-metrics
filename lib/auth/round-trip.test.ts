import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auth } from "./index";
import { getAppDb } from "@/lib/db/app";

type AppDb = ReturnType<typeof getAppDb>;

/**
 * `lib/auth` integration test (issue #11): exercises the real Auth.js +
 * Prisma-adapter seam against the live Neon app DB, mirroring
 * `lib/db/app/round-trip.test.ts`'s harness shape. It does NOT drive an
 * actual magic-link email — Resend env is deliberately not required (per the
 * PRD's testing notes) — it seeds a User row directly and resolves `auth()`
 * against a fake request carrying a session cookie built with `next-auth`'s
 * own JWT `encode()` (matching this slice's JWT session strategy — see
 * `lib/auth/index.ts`'s top comment), the same way the real cookie Auth.js
 * issues after a magic-link sign-in is validated.
 *
 * SKIPPED when `DATABASE_URL` or `AUTH_SECRET` is absent (e.g. CI / a fresh
 * checkout before provisioning). Type-check and unit tests still pass in
 * that state. Every row created here is deleted in `afterAll`.
 */
const describeIfConfigured =
  process.env.DATABASE_URL && process.env.AUTH_SECRET
    ? describe
    : describe.skip;

describeIfConfigured("lib/auth session round-trip", () => {
  let db: AppDb;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = getAppDb();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // `onDelete: Cascade` on Session.user removes the matching Session row.
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await db.$disconnect();
  });

  /**
   * Calls `auth()` against a bare request — no session cookie. Only
   * `.headers` is read at runtime (see `next-auth/lib/index.js`'s "API
   * Routes" branch); the rest of the Pages-API request/response shape is
   * irrelevant here, hence the casts. `x-forwarded-proto: http` matters:
   * with no `AUTH_URL` set and no protocol header, Auth.js' URL detection
   * defaults to "https" (see `@auth/core`'s `createActionURL`), which makes
   * it expect the `__Secure-`-prefixed cookie name instead of the plain one
   * used below.
   */
  async function resolveSessionFor(cookie: string | null) {
    const req = {
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "http",
        ...(cookie ? { cookie } : {}),
      },
    } as unknown as NextApiRequest;
    const res = { headers: new Headers() } as unknown as NextApiResponse;
    return auth(req, res);
  }

  it("returns null for an unauthenticated request", async () => {
    const session = await resolveSessionFor(null);
    expect(session).toBeNull();
  });

  it("returns a typed session with sucursalIds: [] for a signed-in user", async () => {
    const email = `round-trip-${Date.now()}@example.com`;
    const user = await db.user.create({ data: { email } });
    createdUserIds.push(user.id);

    // The JWT session cookie Auth.js issues after a real magic-link sign-in,
    // built directly with its own encoder — the salt must match the session
    // cookie's name (`@auth/core`'s `lib/actions/session.js`).
    const sessionToken = await encode({
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
      token: { sub: user.id, email, name: null, picture: null },
    });

    const session = await resolveSessionFor(
      `authjs.session-token=${sessionToken}`,
    );

    expect(session?.user?.email).toBe(email);
    expect(Array.isArray(session?.user?.sucursalIds)).toBe(true);
    expect(session?.user?.sucursalIds).toEqual([]);
  });
});
