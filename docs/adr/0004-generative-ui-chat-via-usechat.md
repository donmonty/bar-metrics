# 4. Generative-UI chat (tools render components), built through a prose milestone

Date: 2026-06-19
Status: Accepted

## Context

The chatbot is a tool-calling agent (ADR 0001) on the Vercel AI SDK + Claude.
The question is how richly it presents answers and how coupled it is to the
dashboard views. Options ranged from a decoupled "ask anything" box, to a
context-aware assistant, to **generative UI** where the agent's tools render
charts/tables inline rather than only prose.

A primary project goal is a portfolio piece; generative UI is the most
compelling thing to demo in this space. The dashboard already needs chart/table
components, and the fixed tools already return structured data.

## Decision

Target **generative UI (tools render React components)** as the v1 goal, but
build it **through** a prose milestone so the project is never blocked:

1. **Milestone A (option 2):** context-aware tool-calling chat that answers in
   prose. The chat receives the user's Sucursales (from session) AND the active
   dashboard view context (sucursal, date range, metric). This is a complete,
   shippable product on its own.
2. **Milestone B (option 3):** swap prose for components. Use the stable
   **`useChat` + tool-invocations** pattern: each assistant message carries
   `toolInvocations` with `toolName`/`args`/`result`; a client-side
   `toolName → component` map renders e.g. `<MermaBarChart data={result} />`.
   **Reuse the same chart components built for the dashboard.** A short prose
   summary still accompanies the rendered component.

Prefer `useChat` over the experimental `ai/rsc` `streamUI` API for robustness.
The escape-hatch tool (arbitrary result shapes) falls back to a generic table or
prose.

## Consequences

- **Positive:** Marginal cost of generative UI is ~+20–30% on the chat layer
  (not a rewrite) because dashboard charts are reused and tools already return
  structured data. Headline demo feature. Always have a shippable fallback
  (Milestone A) if time runs short.
- **Negative:** Requires per-component loading/error states and keeping tool
  output shapes stable. Generative UI does not apply to the escape-hatch tool.
