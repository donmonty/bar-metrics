/**
 * `lib/auth` — the SOLE import surface for session/authentication state
 * (ADR 0002, issue #11).
 *
 * Downstream code never imports `next-auth` or `lib/db/app` for auth state;
 * it calls `auth()`, `signIn`, or `signOut` from here. This mirrors the
 * `lib/db/app` / `lib/db/nubebar` convention of a single seam per concern
 * (issues #4/#5): this module is for "who is signed in and what scope they
 * have," not "what lives in the database."
 *
 * `session.user.sucursalIds` was always `[]` through Slice 1 — the typed
 * shape was locked in early so Step 3's dashboard could already depend on
 * it. Slice 2 (issue #12) populates it for real: `assignSucursales` (below)
 * writes `UserSucursal` rows, and this module's `session` callback override
 * reads them back on every session resolution.
 *
 * **Why the `session` callback lives here, not in the shared
 * `lib/auth/config.ts`:** with the JWT strategy, `session()` still runs
 * server-side on every `auth()` call in the Node runtime (route handlers,
 * server components) — it is a DB read, not a token decode. `config.ts`'s
 * stub (`sucursalIds = []`) stays in place for the Edge-safe half
 * (`lib/auth/edge.ts`, used only by `middleware.ts`), which must never touch
 * `pg`. This gives downstream code fresh-per-request `sucursalIds` without a
 * new sign-in, matching the PRD's "re-assigning and re-resolving the Session
 * yields the new list" expectation more closely than baking the list into
 * the JWT at mint time (`jwt()`) would.
 *
 * **Divergence from the PRD's suggested default (documented, one-line
 * justification invited by the PRD itself):** sessions use the **JWT**
 * strategy, not Auth.js' database-session default. `middleware.ts` calls
 * `auth()` to redirect unauthenticated visits, and Next.js Middleware runs
 * in the Edge runtime, which can't open the `pg` connection the Prisma
 * adapter needs (Edge has no TCP sockets). A JWT session verifies itself
 * from its signed cookie — no DB round trip — so it works in Edge
 * middleware. The adapter is still wired here for the rest of the app (it
 * persists `User`/`Account`/`VerificationToken` rows for the Resend
 * magic-link flow); only session *storage* is JWT instead of a `Session`
 * table row. `lib/auth/config.ts` holds the Edge-safe half of the config
 * (no providers, no adapter) that `middleware.ts` uses directly (via
 * `lib/auth/edge.ts`), mirroring Auth.js v5's own documented
 * `auth.config.ts` + `auth.ts` split. The Resend provider has to live here,
 * not in the shared config, because Auth.js requires an adapter wherever an
 * `email`-type provider is configured — see `lib/auth/config.ts`'s comment.
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { authConfig } from "./config";
import { getAppDb, isAppDbConfigured } from "@/lib/db/app";
import { findExistingSucursalIds } from "@/lib/db/nubebar";

/** Whether Auth.js has its required session-encryption secret configured. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

/** Whether the Resend magic-link provider has its env vars configured. */
export function isResendConfigured(): boolean {
  return (
    Boolean(process.env.AUTH_RESEND_KEY) && Boolean(process.env.AUTH_EMAIL_FROM)
  );
}

/** Reads the Sucursal IDs currently assigned to a User (issue #12). */
async function getSucursalIdsForUser(userId: string): Promise<number[]> {
  const rows = await getAppDb().userSucursal.findMany({
    where: { userId },
    select: { sucursalId: true },
  });
  return rows.map((row) => row.sucursalId);
}

/**
 * Replaces the set of Sucursales a User (by email) is scoped to (issue #12).
 * Idempotent — delete-missing/insert-new/leave-overlap-untouched semantics —
 * and pre-creates the `User` row if the email hasn't signed in yet, so an
 * operator can authorize a fresh email before its first magic-link sign-in.
 *
 * Every `sucursalId` is validated against the live nubebar read model first;
 * a non-existent ID throws before any row is written. This is the only
 * place downstream code (the seed script, any future admin UI) writes
 * `UserSucursal` — it never touches `lib/db/app`'s generated client itself.
 */
export async function assignSucursales(
  email: string,
  sucursalIds: number[],
): Promise<void> {
  const existingIds = await findExistingSucursalIds(sucursalIds);
  const missingIds = sucursalIds.filter((id) => !existingIds.includes(id));
  if (missingIds.length > 0) {
    throw new Error(
      `Cannot assign unknown Sucursal ID(s) to ${email}: ${missingIds.join(", ")}. ` +
        "Check the IDs against the nubebar read model (e.g. Prisma Studio on lib/db/nubebar).",
    );
  }

  const db = getAppDb();
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  await db.$transaction([
    db.userSucursal.deleteMany({
      where: { userId: user.id, sucursalId: { notIn: sucursalIds } },
    }),
    ...sucursalIds.map((sucursalId) =>
      db.userSucursal.upsert({
        where: { userId_sucursalId: { userId: user.id, sucursalId } },
        update: {},
        create: { userId: user.id, sucursalId },
      }),
    ),
  ]);
}

// The adapter is constructed lazily, inside the config callback below,
// rather than at module scope — `getAppDb()` throws when `DATABASE_URL` is
// absent, and importing this module must never throw (the app DB may not be
// provisioned yet, e.g. a fresh checkout or a deploy before secrets are
// wired).
const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  adapter: isAppDbConfigured() ? PrismaAdapter(getAppDb()) : undefined,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      session.user.sucursalIds = token.sub
        ? await getSucursalIdsForUser(token.sub)
        : [];
      return session;
    },
  },
}));

export { handlers, auth, signIn, signOut };
