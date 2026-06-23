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
npm test           # Vitest unit tests
npm run build      # production build
```

Verify the app booted: `curl http://localhost:3000/health` → `{"status":"ok","service":"bar-metrics"}`.

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
- **Health check:** `curl https://bar-metrics.vercel.app/health` → `{"status":"ok","service":"bar-metrics"}`
- **Framework preset:** Next.js (auto-detected — build `next build`, no custom
  config needed).

### Environment variables on Vercel

The skeleton boots with **no** environment variables. As later slices land, add
each variable from [`.env.example`](.env.example) under the Vercel project's
**Settings → Environment Variables** (names below; never paste secret values into
the repo):

| Variable               | Introduced by       | Purpose                                                   |
| ---------------------- | ------------------- | --------------------------------------------------------- |
| `DATABASE_URL`         | issue #4 / ADR 0003 | Neon app DB (Auth.js sessions, app tables) — pooled URL   |
| `NUBEBAR_DATABASE_URL` | issue #5 / ADR 0003 | Read-only legacy nubebar Postgres read-model — pooled URL |
| `ANTHROPIC_API_KEY`    | ADR 0001 / 0004     | Claude API key for the tool-calling chatbot               |

Both database URLs must use **pooled** connections (ADR 0003) since Vercel
functions are serverless.

## Status

Greenfield. See the ADRs for the build sequence. One open item: verify
DigitalOcean Managed Postgres allows custom roles + RLS (gates ADR 0002).
