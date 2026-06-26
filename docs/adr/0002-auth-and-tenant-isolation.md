# 2. Independent Auth.js login + RLS-based tenant isolation for the agent

Date: 2026-06-19
Status: Accepted, amended 2026-06-26 (see Amendment)

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
- **RESOLVED 2026-06-26:** DigitalOcean Managed Postgres fully supports custom
  login roles and RLS, confirmed by a spike
  ([issue #30](https://github.com/donmonty/bar-metrics/issues/30)) and by the
  real implementation ([issue #32](https://github.com/donmonty/bar-metrics/issues/32),
  [PR #34](https://github.com/donmonty/bar-metrics/pull/34)). The
  read-only-role-+-views fallback was never needed.

## Amendment (2026-06-26, from issue #32's implementation)

This ADR's original Decision said RLS should restrict `nubebar_agent`, but did
not say how `FORCE ROW LEVEL SECURITY` interacts with table ownership. In
practice, `FORCE` is **not used** on this cluster:

- The table owner for DDL purposes (`db`) is the **same role** the existing
  trusted-app-role dashboard seam (`lib/db/nubebar`) connects as via
  `NUBEBAR_DATABASE_URL`.
- `FORCE ROW LEVEL SECURITY` makes RLS apply even to the owning role. Applying
  it as originally specified broke the live dashboard's reads (zero rows
  returned) because no policy was scoped to `db`.
- **Fix:** every policy carries an explicit `TO nubebar_agent` clause, and
  `FORCE` is omitted entirely. Without `FORCE`, RLS still fully restricts any
  non-owner role — `nubebar_agent`'s isolation is intact and verified by
  `lib/db/nubebar/agent-rls.test.ts` — while `db`'s existing unrestricted,
  already-trusted, already app-filtered access is preserved.
- **Implication for future work:** any new role added to this cluster that
  needs RLS enforcement must get its own explicit `TO <role>` policy scope.
  `FORCE` should not be re-introduced here unless every existing caller of the
  owning role (`db`) is also given a policy — otherwise it will silently break
  unrelated reads again.
