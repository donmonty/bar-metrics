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

## Status

Greenfield. See the ADRs for the build sequence. One open item: verify
DigitalOcean Managed Postgres allows custom roles + RLS (gates ADR 0002).
