/**
 * Auth.js module augmentation (issue #11) — types `session.user.sucursalIds`
 * so downstream code (Step 3's dashboard, Step 5/6's chatbot) gets
 * TypeScript safety on the Sucursal-scoping contract this slice locks in.
 * Always `[]` until Slice 2 (#12) populates it from `UserSucursal`.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      sucursalIds: number[];
    };
  }
}
