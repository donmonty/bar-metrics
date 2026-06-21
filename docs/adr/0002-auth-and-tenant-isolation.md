# 2. Independent Auth.js login + RLS-based tenant isolation for the agent

Date: 2026-06-19
Status: Accepted (one open verification — see Consequences)

## Context

The new dashboard (Next.js + Prisma, separate repo) reads the existing nubebar
Postgres directly. Bar managers must only ever see data for their own
**Sucursales**. The Django `User` already models this as a many-to-many from
user to Sucursal.

A specific risk comes from [ADR 0001](0001-chatbot-tool-calling-with-sql-escape-hatch.md):
the chatbot has a read-only SQL escape-hatch tool that runs SQL written by the
LLM. App-layer filtering alone cannot safely contain arbitrary generated SQL.

## Decision

**Authentication:** Independent auth via **Auth.js (NextAuth)** in the new app.
Do **not** reuse Django session credentials. Start a clean user table for the
new app (existing managers re-onboard); do not migrate Django password hashes.

**Tenant isolation — defense in the database, not just the app:**

- Fixed tools use a trusted read-write/app role; the `sucursalId` filter is
  injected from the **session**, never from the model.
- The escape-hatch tool runs through a dedicated **read-only Postgres role**
  (`nubebar_agent`) with `SELECT`-only grants and **no** write privileges.
- **Row-Level Security (RLS)** policies on tenant-bearing tables restrict
  `nubebar_agent` to rows whose `sucursal_id` is in a per-request session
  setting (`SET app.sucursal_ids = '{...}'`), set by trusted server code from
  the Auth.js session before executing model SQL.
- Django's existing role is unaffected (policies target the agent role only).

Net: three roles on one database — Django's existing role (untouched), a trusted
app role (dashboard), and the locked-down read-only `nubebar_agent` (LLM SQL).

## Consequences

- **Positive:** The database is the blast-radius boundary; tenant isolation does
  not depend on app code being bug-free. RLS is a strong, demonstrable pattern.
- **Negative / coupling:** RLS policies are added to a schema Django owns — a
  documented shared-schema coupling.
- **OPEN — must verify before committing:** Confirm DigitalOcean Managed
  Postgres permits creating custom login roles and enabling/forcing RLS. Managed
  providers usually do, but DO's permission model should be checked first. If it
  does not, fall back to a read-only role + pre-scoped per-tenant views.
