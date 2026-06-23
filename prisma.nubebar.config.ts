import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Separate config for the nubebar (read-only) schema — kept apart from
// `prisma.config.ts` (the app DB) so each database has its own datasource URL
// and the CLI never points the wrong schema at the wrong connection. Pass
// `--config prisma.nubebar.config.ts` when running Prisma CLI commands against
// this schema (see the `db:nubebar:*` npm scripts).
loadEnv({ path: [".env.local", ".env"], quiet: true });

// nubebar Postgres (DigitalOcean) — strictly read-only (ADR 0003, issue #5).
// `prisma db pull` (introspection) is the ONLY Prisma CLI command ever run
// against this datasource. Never run `prisma migrate` here — Django owns
// writes and migrations for this database.
//
// Connects over a DigitalOcean Connection Pool (PgBouncer-backed), not the
// cluster's raw connection — required for Vercel's serverless functions
// (ADR 0003). `process.env` (not `env()`) so `prisma generate` still works
// without a connection (e.g. CI before the env var is wired).
export default defineConfig({
  schema: "prisma/nubebar/schema.prisma",
  datasource: {
    url: process.env.NUBEBAR_DATABASE_URL ?? "",
  },
});
