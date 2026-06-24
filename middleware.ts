/**
 * Redirects unauthenticated visits to authenticated routes to `/login`
 * (issue #11). `/login`, `/health`, and the Auth.js API routes stay public.
 * Imports the Edge-safe `auth()` from `lib/auth/edge` (no Prisma adapter) —
 * see that file's comment and `lib/auth/index.ts`'s top comment for why.
 */
import { auth } from "@/lib/auth/edge";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/me"],
};
