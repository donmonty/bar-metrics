# 1. Chatbot uses tool-calling over typed Prisma queries, plus one read-only SQL escape hatch

Date: 2026-06-19
Status: Accepted

## Context

The new dashboard (separate repo, Next.js + Prisma + TypeScript on Vercel) includes
a chatbot that lets bar managers drill into nubebar data — primarily **merma**
(consumption variance), stock value, and sales. The data lives in the existing
DigitalOcean Postgres owned by the Django app; the new app reads it directly via
Prisma (see [glossary](../../CONTEXT.md)).

A primary goal of the project is for the author to learn to build AI-agent apps
and have a portfolio piece for a job search, so the architecture should
demonstrate deliberate agent design — not just delegate everything to the model.

We considered three points on the agentic spectrum:

1. **Text-to-SQL** — the LLM writes raw SQL against the schema.
2. **Tool/function-calling over a fixed set of typed queries** — the LLM chooses
   and composes hand-written, trusted Prisma-backed tools.
3. **MCP server** exposing those tools to decouple the agent layer.

## Decision

Build the chatbot as a **tool-calling agent (option 2)**: a curated set of
well-named, typed tools (e.g. `getMermaByIngredient`, `getTopVarianceItems`,
`getStockValue`), each backed by a Prisma query we own, validate, and test. The
model selects tools, supplies arguments, loops over results, and synthesizes the
answer.

Add **one guarded read-only SQL escape-hatch tool** (`runAnalyticalQuery`) for
open-ended questions the fixed toolset can't anticipate. It executes against a
**read-only Postgres role / restricted views**, never the app's main credentials.

Design the tools so they can later be re-exposed via an **MCP server (option 3)**
as a phase-2 stretch, without rewriting them.

## Consequences

- **Positive:** Teaches real agent design (tool schemas, the tool-use loop,
  argument validation, multi-step reasoning). Every fixed tool is safe, testable,
  and reviewable — the repo reads as deliberate engineering. The escape hatch
  preserves flexibility for the long tail of questions.
- **Negative / risks:** The escape-hatch tool is the main safety surface; it must
  be locked to a read-only role, statement-timeout'd, and ideally row/tenant
  scoped. Fixed tools require upfront design and maintenance as questions evolve.
- **Deferred:** Whether to promote the toolset to an MCP server; whether the
  escape hatch graduates from "guarded raw SQL" to a safer constrained-query DSL.
