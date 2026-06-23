/**
 * Liveness/readiness probe for the bar-metrics app.
 *
 * Confirms the Next.js server booted and serves a request, and now (issue #4)
 * surfaces a small app-DB readout end to end: the `health_checks` row count
 * from the Neon app DB (ADR 0003). The readout degrades gracefully — when the
 * DB isn't configured or is unreachable the probe still returns 200 with a
 * `db` field describing the state, so it never falsely reports the app as down.
 */
import { readAppDbHealth } from "@/lib/db/app";

// Always evaluate at request time so the probe reflects a live server (and a
// live DB connection), not a build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readAppDbHealth();
  return Response.json({ status: "ok", service: "bar-metrics", db });
}
