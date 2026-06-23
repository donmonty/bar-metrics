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

Verify the app booted: `curl http://localhost:3000/health`. The response now
includes an app-DB readout (ADR 0003): `{"status":"ok","service":"bar-metrics","db":{...}}`.
With no database configured the `db` field reports `{"configured":false}`; once
the Neon store is wired it reports the `health_checks` row count.

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

## Deployment (Vercel)

Hosted on [Vercel](https://vercel.com) (see
[ADR 0003](docs/adr/0003-two-databases-neon-app-db.md)). The project is connected
to this GitHub repo via Vercel's Git integration, so **every push to `main`
redeploys automatically** (continuous deploy); pull requests get preview
deployments.

- **Live URL:** https://bar-metrics.vercel.app
- **Health check:** `curl https://bar-metrics.vercel.app/health` → `{"status":"ok","service":"bar-metrics","db":{...}}`
- **Framework preset:** Next.js (auto-detected — build `next build`, no custom
  config needed).

### Environment variables on Vercel

The skeleton boots with **no** environment variables. As later slices land, add
each variable from [`.env.example`](.env.example) under the Vercel project's
**Settings → Environment Variables** (names below; never paste secret values into
the repo):

| Variable                | Introduced by       | Purpose                                                   |
| ----------------------- | ------------------- | --------------------------------------------------------- |
| `DATABASE_URL`          | issue #4 / ADR 0003 | Neon app DB — **pooled** runtime connection               |
| `DATABASE_URL_UNPOOLED` | issue #4 / ADR 0003 | Neon app DB — **direct** connection for Prisma Migrate    |
| `NUBEBAR_DATABASE_URL`  | issue #5 / ADR 0003 | Read-only legacy nubebar Postgres read-model — pooled URL |
| `ANTHROPIC_API_KEY`     | ADR 0001 / 0004     | Claude API key for the tool-calling chatbot               |

The Neon/Vercel integration injects both `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` automatically. Runtime connections must be **pooled**
(ADR 0003) since Vercel functions are serverless; migrations use the direct URL.

## Status

Greenfield. See the ADRs for the build sequence. One open item: verify
DigitalOcean Managed Postgres allows custom roles + RLS (gates ADR 0002).
