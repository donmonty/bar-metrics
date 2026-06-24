# bar-metrics

Dashboard + AI chatbot for nubebar bar managers. Reads the existing nubebar
Postgres (owned for writes by the legacy `api-nubebar-django` app) and surfaces
metrics — headlined by **merma** (consumption variance) — plus a tool-calling
chatbot to drill into the data.

## Design docs

- **Domain glossary (shared kernel):** [docs/CONTEXT.md](docs/CONTEXT.md)
- **Architecture decisions:** [docs/adr/](docs/adr/)
  - [0001](docs/adr/0001-chatbot-tool-calling-with-sql-escape-hatch.md) — chatbot = tool-calling + read-only SQL escape hatch
  - [0002](docs/adr/0002-auth-and-tenant-isolation.md) — Auth.js + RLS tenant isolation
  - [0003](docs/adr/0003-two-databases-neon-app-db.md) — two DBs (read-only nubebar + Neon app DB)
  - [0004](docs/adr/0004-generative-ui-chat-via-usechat.md) — generative-UI chat via `useChat`

## Stack

Next.js (App Router) + Server Actions · TypeScript · Prisma · Vercel AI SDK +
Claude · Auth.js · Neon (app DB) + DigitalOcean Postgres (read-only nubebar DB).

## Runbook

Prerequisites: Node.js 20+ and npm.

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:3000
npm run lint       # ESLint (next/core-web-vitals + TypeScript rules)
npm run format     # Prettier — format in place (format:check to verify only)
npm run typecheck  # strict TypeScript, no emit
npm test           # Vitest unit + integration tests (DB tests skip w/o env)
npm run build      # production build
```

`npm install` runs `prisma generate` (postinstall) to build the app-DB client
into `lib/db/app/generated/` (gitignored).

Verify the app booted: `curl http://localhost:3000/health`. The response
includes two DB readouts (ADR 0003):
`{"status":"ok","service":"bar-metrics","db":{...},"nubebar":{...}}`. With no
database configured each field reports `{"configured":false}`; once wired, `db`
reports the `health_checks` row count (Neon app DB) and `nubebar` reports the
Sucursal count (read-only nubebar read model).

## App database (Neon, ADR 0003)

The app owns a read-write Postgres on Neon's free tier (issue #4 / ADR 0003),
accessed with its own Prisma schema/client — kept separate from the future
read-only nubebar read-model client (issue #5).

- **Schema:** [`prisma/app/schema.prisma`](prisma/app/schema.prisma) — generates
  a client into `lib/db/app/generated/` (gitignored).
- **Sole import surface:** [`lib/db/app`](lib/db/app/index.ts). Nothing else
  imports the generated client directly, keeping the write-model boundary crisp.
- **Connections (ADR 0003):** runtime uses the **pooled** PgBouncer connection
  (`DATABASE_URL`) through the `@prisma/adapter-pg` driver adapter — required for
  Vercel's serverless functions. Prisma Migrate uses the **direct** unpooled
  connection (`DATABASE_URL_UNPOOLED`), wired in
  [`prisma.config.ts`](prisma.config.ts).

Database scripts:

```bash
npm run db:app:generate        # regenerate the client (also runs on install)
npm run db:app:migrate:deploy  # apply committed migrations (CI / prod)
npm run db:app:migrate:dev     # create + apply a migration in development
npm run db:app:studio          # open Prisma Studio
```

### Provisioning the Neon store (one-time)

The code (schema, client, seam, initial migration, round-trip test, health
readout) is complete and committed, but creating the actual Neon database is a
dashboard step that can't be automated from here. To bring it online:

1. In the **Vercel dashboard → Storage → Create Database → Neon (Postgres)**,
   attach it to the `bar-metrics` project. This auto-injects `DATABASE_URL`
   (pooled) and `DATABASE_URL_UNPOOLED` (direct) into the project's env vars.
2. Pull them locally: `vercel env pull .env.local` (or paste both URLs into
   `.env.local`, copying [`.env.example`](.env.example)).
3. Apply the initial migration: `npm run db:app:migrate:deploy`.
4. Run the integration test for real (it un-skips once `DATABASE_URL` is set):
   `npm test`. The migration round-trip in
   [`lib/db/app/round-trip.test.ts`](lib/db/app/round-trip.test.ts) writes a row,
   reads it back, and cleans up.
5. Confirm the readout: `curl http://localhost:3000/health` now shows
   `"db":{"configured":true,"reachable":true,"healthChecks":<n>}`.

### Environment

Copy [`.env.example`](.env.example) to `.env.local` and fill in values as later
slices need them. **The skeleton needs no environment variables to run.** Secrets
are never committed — `.env*` is gitignored except `.env.example`.

## nubebar read model (DigitalOcean, ADR 0003, issue #5)

The app reads the legacy nubebar Postgres (DigitalOcean Managed Database) —
**strictly read-only**: the legacy Django app (`api-nubebar-django`) owns this
schema for writes (iOS scan/ingestion). This is the app's second Prisma
schema/client, kept entirely separate from the read-write app DB above. The
schema is **introspected, not hand-written** — it mirrors Django's actual
tables (the glossary entities: `core_sucursal`, `core_almacen`, `core_botella`,
`core_venta`, `core_inspeccion`, …; see [docs/CONTEXT.md](docs/CONTEXT.md)).

- **Schema (committed artifact):**
  [`prisma/nubebar/schema.prisma`](prisma/nubebar/schema.prisma) — generated by
  `prisma db pull`, never hand-edited. Generates a client into
  `lib/db/nubebar/generated/` (gitignored).
- **Sole import surface:** [`lib/db/nubebar`](lib/db/nubebar/index.ts) — exposes
  only read helpers (`countSucursales`, `readNubebarDbHealth`); there is no
  write path. Nothing else imports the generated client directly.
- **Connection:** runtime uses a **DigitalOcean Connection Pool**
  (PgBouncer-backed, required for Vercel's serverless functions — ADR 0003)
  through the `@prisma/adapter-pg` driver adapter, wired in
  [`prisma.nubebar.config.ts`](prisma.nubebar.config.ts). DigitalOcean's
  managed Postgres uses a self-signed CA, so the connection string needs
  `?sslmode=no-verify` (still TLS-encrypted, just skips chain verification).
- **`prisma db pull` is the only Prisma CLI command ever run against this
  datasource — never `prisma migrate`.** Django owns writes and migrations.

Refresh the introspected schema after a Django migration (to see the diff):

```bash
npm run db:nubebar:pull       # re-introspect: prisma db pull --config prisma.nubebar.config.ts
npm run db:nubebar:generate   # regenerate the client (also runs on install/build)
git diff prisma/nubebar/schema.prisma   # review the drift before committing
```

### One-time setup: the DigitalOcean Connection Pool

1. In the DigitalOcean dashboard, open the nubebar Postgres cluster →
   **Connection Pools** → **Create a Connection Pool**: database `db`, user
   `db` (the least-privileged user available; the locked-down `nubebar_agent`
   role + RLS is a separate, later slice — ADR 0002), mode **Transaction**.
2. Copy the resulting pool connection string (a distinct host/port from the
   cluster's raw connection) into `.env.local` as `NUBEBAR_DATABASE_URL`,
   appending `?sslmode=no-verify`.
3. If the cluster's IP allowlist (DB → Settings → Trusted Sources) blocks your
   machine, add your IP there first — introspection and the integration test
   both need to reach the DB directly.
4. Run the real-DB integration test: `npm test`. The test in
   [`lib/db/nubebar/read.test.ts`](lib/db/nubebar/read.test.ts) counts
   Sucursales against the live DB and skips cleanly when the env var is
   absent.
5. Confirm the readout: `curl http://localhost:3000/health` now shows
   `"nubebar":{"configured":true,"reachable":true,"sucursales":<n>}`.

## Authentication (Auth.js v5 + Resend, ADR 0002, issue #11)

Bar managers sign in with **email magic links** — no passwords, no OAuth.
**Auth.js v5** (`next-auth@5`) issues the link via the **Resend** provider;
clicking it lands the manager on `/me`, a placeholder authenticated page that
confirms the signed-in email and (for now, always empty — Slice 2/#12 wires
the real values) the Sucursales they're scoped to.

- **Sole import surface:** [`lib/auth`](lib/auth/index.ts) — exposes `auth()`,
  `signIn`, `signOut`, and the route `handlers`. Downstream code never imports
  `next-auth` directly. `lib/auth/edge.ts` is a second, Edge-runtime-safe
  entry point used only by [`middleware.ts`](middleware.ts) — see the top
  comments in both `lib/auth/index.ts` and `lib/auth/config.ts` for why the
  split exists (the Prisma adapter needs `pg`'s TCP sockets, unavailable in
  Next.js Middleware's Edge runtime; JWT sessions make the split safe).
- **Schema:** `User`, `Account`, `Session`, `VerificationToken` were added to
  [`prisma/app/schema.prisma`](prisma/app/schema.prisma) via the same
  migration pipeline Step 1 set up (`npm run db:app:migrate:dev`/`:deploy`).
  `@auth/prisma-adapter` wires them to the existing app-DB client.
- **Session strategy:** JWT, not Auth.js' database-session default — a
  documented divergence (see `lib/auth/index.ts`'s top comment) required by
  the Edge-middleware constraint above.
- **Protected routes:** [`middleware.ts`](middleware.ts) redirects
  unauthenticated visits to `/me` (and any future authenticated route added
  to its `matcher`) to `/login`. `/login` and `/health` stay public.
- **`/health` readout:** `{"auth": {"configured": <AUTH_SECRET present>,
"resendConfigured": <AUTH_RESEND_KEY + AUTH_EMAIL_FROM present>}}` — no PII,
  no session data.

### One-time setup: local environment

1. Generate a session-encryption secret and add it to `.env.local`:
   `openssl rand -base64 32`, then `AUTH_SECRET=<value>`. (Auth.js' own
   `npx auth secret` CLI is for a different, unrelated "auth" npm package —
   don't use it; generate the value directly.)
2. Create a free account at [resend.com](https://resend.com) → **API Keys** →
   create a key → add it to `.env.local` as `AUTH_RESEND_KEY`. Never paste
   the key into chat, an issue, or a PR — edit `.env.local` directly.
3. Set the sender address `AUTH_EMAIL_FROM` in `.env.local`. Two options:
   - **Quick local testing:** `AUTH_EMAIL_FROM=onboarding@resend.dev` —
     Resend's built-in sandbox sender, no domain verification needed, but it
     can only deliver to the email address registered on your Resend
     account.
   - **Real demo / production:** verify a domain you own under
     resend.com/domains, then use an address at that domain.
4. Apply the migration if you haven't already: `npm run db:app:migrate:deploy`.

### Testing the login flow end to end

1. `npm run dev`, then visit `http://localhost:3000/login`.
2. Enter your email (the one registered on your Resend account, if using the
   sandbox sender) and submit.
3. Check your inbox for the magic-link email from Resend and click it.
4. You should land on `/me`, showing your email and `Sucursal IDs: []`.
5. Visit `/me` in an incognito/unauthenticated browser to confirm the
   redirect to `/login`.
6. `curl http://localhost:3000/health` should show
   `"auth":{"configured":true,"resendConfigured":true}`.

The real-DB integration test ([`lib/auth/round-trip.test.ts`](lib/auth/round-trip.test.ts))
covers the seam itself (an unauthenticated request resolves to `null`; a
seeded user resolves to a typed session with `sucursalIds: []`) without
sending an actual email — it's skipped when `DATABASE_URL` or `AUTH_SECRET`
is absent, same pattern as Step 1's DB tests.

## Sucursal scoping (ADR 0002, issue #12)

Bar managers are scoped to one or more Sucursales via the **`UserSucursal`**
join table on the app DB. There is no admin UI yet — assignment is a
**dev-only CLI script** the operator runs from their machine.

- **Schema:** `UserSucursal(userId, sucursalId, assignedAt)` in
  [`prisma/app/schema.prisma`](prisma/app/schema.prisma), added via its own
  migration (separate from Slice 1's Auth.js tables). `sucursalId` mirrors
  `core_sucursal.id` in the nubebar read model with **no cross-DB foreign
  key** — the two databases stay independent (ADR 0003); validity is checked
  in application code instead.
- **Seam:** [`lib/auth.assignSucursales(email, sucursalIds)`](lib/auth/index.ts)
  — idempotent replace-set semantics, pre-creates the `User` row if the
  email hasn't signed in yet, and validates every ID against the live
  nubebar read model (`lib/db/nubebar.findExistingSucursalIds`) before
  writing anything.
- **Session enrichment:** the `session` callback in `lib/auth/index.ts`
  (not the shared Edge-safe `lib/auth/config.ts`) reads `UserSucursal` on
  every session resolution, so re-assigning and reloading the page reflects
  the new list immediately — no new sign-in required. See that file's top
  comment for why it has to live there given the JWT session strategy.

### Create a test User and assign Sucursales locally

```bash
# 1. Find a real Sucursal ID from the live nubebar data, e.g. via Prisma Studio:
npm run db:nubebar:generate && npx prisma studio --schema prisma/nubebar/schema.prisma
# (or query lib/db/nubebar.findExistingSucursalIds / countSucursales directly)

# 2. Assign it to a test email — pre-creates the User row if it doesn't exist yet:
npm run db:app:assign-sucursales -- --email test@example.com --sucursales 1

# 3. Sign in as that email via /login (see "Testing the login flow end to end"
#    above) and confirm /me shows "Sucursal IDs: [1]".

# 4. Re-run with a different set — the next sign-in (or page reload, since the
#    session callback re-reads on every resolution) reflects the change:
npm run db:app:assign-sucursales -- --email test@example.com --sucursales 1,2

# 5. Re-running with the same set is a no-op (no duplicate rows):
npm run db:app:assign-sucursales -- --email test@example.com --sucursales 1,2

# 6. A non-existent Sucursal ID fails fast, before any row is written:
npm run db:app:assign-sucursales -- --email test@example.com --sucursales 999999
```

The real-DB integration test
([`lib/auth/sucursal-scoping.test.ts`](lib/auth/sucursal-scoping.test.ts))
covers this end to end against the live Neon app DB and the live nubebar
read model: assignment, idempotency, re-assignment, the unknown-ID rejection,
and the unauthenticated-`null` case. It's skipped when `DATABASE_URL`,
`AUTH_SECRET`, or `NUBEBAR_DATABASE_URL` is absent and does not require
Resend env.

## Deployment (Vercel)

Hosted on [Vercel](https://vercel.com) (see
[ADR 0003](docs/adr/0003-two-databases-neon-app-db.md)). The project is connected
to this GitHub repo via Vercel's Git integration, so **every push to `main`
redeploys automatically** (continuous deploy); pull requests get preview
deployments.

- **Live URL:** https://bar-metrics.vercel.app
- **Health check:** `curl https://bar-metrics.vercel.app/health` → `{"status":"ok","service":"bar-metrics","db":{...},"nubebar":{...}}`
- **Framework preset:** Next.js (auto-detected — build `next build`, no custom
  config needed).

### Environment variables on Vercel

The skeleton boots with **no** environment variables. As later slices land, add
each variable from [`.env.example`](.env.example) under the Vercel project's
**Settings → Environment Variables** (names below; never paste secret values into
the repo):

| Variable                     | Introduced by                        | Purpose                                                                                              |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | issue #4 / ADR 0003                  | Neon app DB — **pooled** runtime connection                                                          |
| `DATABASE_URL_UNPOOLED`      | issue #4 / ADR 0003                  | Neon app DB — **direct** connection for Prisma Migrate                                               |
| `NUBEBAR_DATABASE_URL`       | issue #5 / ADR 0003                  | Read-only legacy nubebar Postgres read-model — pooled URL                                            |
| `NUBEBAR_AGENT_DATABASE_URL` | ADR 0002 / step 4 (reserved, unused) | Future locked-down read-only role + RLS for the chatbot's SQL escape hatch — not created in issue #5 |
| `AUTH_SECRET`                | issue #11 / ADR 0002                 | Auth.js v5 session-encryption secret                                                                 |
| `AUTH_RESEND_KEY`            | issue #11 / ADR 0002                 | Resend API key for the magic-link sign-in provider                                                   |
| `AUTH_EMAIL_FROM`            | issue #11 / ADR 0002                 | Verified (or sandbox) sender address for magic-link email                                            |
| `ANTHROPIC_API_KEY`          | ADR 0001 / 0004                      | Claude API key for the tool-calling chatbot                                                          |

The Neon/Vercel integration injects both `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` automatically. Runtime connections must be **pooled**
(ADR 0003) since Vercel functions are serverless; migrations use the direct URL.

## Status

Greenfield. See the ADRs for the build sequence. One open item: verify
DigitalOcean Managed Postgres allows custom roles + RLS (gates ADR 0002).
