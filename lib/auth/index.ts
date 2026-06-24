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
 * `session.user.sucursalIds` is always `[]` in this slice — the typed shape
 * is locked in now so Step 3's dashboard can already depend on it, but the
 * population logic (the `UserSucursal` join table + `assignSucursales`
 * helper) is Slice 2 (issue #12). Nothing here reads the nubebar read model.
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
}));

export { handlers, auth, signIn, signOut };
