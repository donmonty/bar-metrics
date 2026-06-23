import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads `.env`. Load the same files the app uses
// (`.env.local` first, mirroring `vercel env pull`) so CLI commands like
// `prisma migrate deploy` see the connection URL. Missing files are ignored.
loadEnv({ path: [".env.local", ".env"], quiet: true });

// The app-owned (read-write) database — Neon free tier (ADR 0003, issue #4).
//
// Migrations must run over the DIRECT (unpooled) connection: PgBouncer's
// transaction pooling breaks the schema-altering statements Prisma Migrate
// issues. Application runtime instead connects over the POOLED connection via
// the driver adapter in `lib/db/app` (`DATABASE_URL`).
//
// `process.env` (not Prisma's `env()` helper) is used deliberately: `env()`
// throws when the variable is absent, which would break `prisma generate` in
// environments without a database (e.g. the Vercel build before the Neon store
// is wired). Generate needs no connection, so an empty URL is harmless there.
export default defineConfig({
  schema: "prisma/app/schema.prisma",
  migrations: {
    path: "prisma/app/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
