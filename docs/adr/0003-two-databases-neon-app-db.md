# 3. Two databases: read-only nubebar (DigitalOcean) + app-owned DB (Neon free)

Date: 2026-06-19
Status: Accepted

## Context

The new dashboard reads nubebar data directly from the existing DigitalOcean
Postgres, which **Django owns for writes** (iOS scan/ingestion). The chatbot
needs to persist conversations and messages for a resumable, demo-worthy
experience, and Auth.js (ADR 0002) needs its own user/session tables. These are
*new, writable* data that the new app owns.

Writing those tables into Django's schema would muddy the clean boundary
("Django owns writes, new app owns reads") and add writable coupling to a legacy
schema. The user also wants to avoid paying for a second DigitalOcean database.

## Decision

Use **two databases**:

1. **nubebar Postgres (DigitalOcean, existing)** — strictly **read-only** from
   the new app, accessed via Prisma. The chatbot escape hatch uses the
   locked-down `nubebar_agent` role with RLS (ADR 0002). Django keeps full write
   ownership.
2. **App-owned DB (new)** — read-write, owns `conversations`, `messages`, and
   the Auth.js `users`/`sessions` tables. Hosted on **Neon free tier** via the
   native Vercel Postgres integration ($0, scales to zero, auto-wired env vars).
   Supabase free tier is an acceptable alternative (nicer data browser) but Neon
   wins on Vercel integration since auth is already Auth.js, not Supabase Auth.

The new app therefore runs **two Prisma schemas / clients**: one for the
read-only nubebar DB, one for the read-write app DB.

## Consequences

- **Positive:** Clean read-model vs. write-model separation; legacy schema is
  never written to by the new app; $0 incremental cost; a clear architectural
  story for a portfolio review.
- **Negative:** Two Prisma schemas/clients to manage and keep wired.
- **Implementation note — connection pooling (applies to BOTH databases):**
  Vercel serverless functions open many short-lived connections and can exhaust
  Postgres connection limits. Use Neon's built-in pooled (PgBouncer) connection
  string for the app DB, and put a pooler in front of the DigitalOcean read
  connection too (e.g. Prisma `?pgbouncer=true` / a pooled DO connection /
  Prisma Accelerate). Do not point raw serverless connections at either DB
  unpooled.
