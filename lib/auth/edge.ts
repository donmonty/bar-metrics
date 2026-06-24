/**
 * Edge-safe `auth()` for `middleware.ts` only (issue #11) — built from
 * `lib/auth/config.ts`'s adapter-less config, so it never pulls in `pg`.
 * Everything else in the app imports the full seam from `lib/auth` (this
 * file's sibling `index.ts`), which adds the Prisma adapter. See that file's
 * top comment for why the split is needed and why JWT sessions make it safe.
 */
import NextAuth from "next-auth";

import { authConfig } from "./config";

export const { auth } = NextAuth(authConfig);
