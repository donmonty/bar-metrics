/**
 * The Edge-safe slice of the Auth.js config — pages, session strategy, and
 * callbacks, but deliberately NO providers and NO adapter (issue #11).
 * Auth.js' `assertConfig` requires an adapter whenever an `email`-type
 * provider (Resend) is present, regardless of session strategy — so the
 * Resend provider itself, not just the adapter, has to live in the
 * Node-only full config (`lib/auth/index.ts`), which `middleware.ts` cannot
 * use (its Prisma adapter pulls in `pg`'s TCP sockets, unavailable in the
 * Edge runtime middleware runs in). This is Auth.js v5's own documented
 * split (`auth.config.ts` + `auth.ts`); middleware only ever needs to read
 * an existing JWT session cookie, never to call `signIn`, so the missing
 * provider doesn't matter there.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    session({ session }) {
      // Sucursal scoping is populated in Slice 2 (issue #12, UserSucursal).
      // This slice locks in the typed shape so downstream code can already
      // depend on `session.user.sucursalIds: number[]`.
      session.user.sucursalIds = [];
      return session;
    },
  },
};
