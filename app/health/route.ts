/**
 * Liveness/readiness probe for the bar-metrics app.
 *
 * Confirms the Next.js server booted and serves a request, and surfaces two
 * small DB readouts end to end: the `health_checks` row count from the Neon
 * app DB (issue #4 / ADR 0003), and the Sucursal count from the read-only
 * nubebar read model (issue #5 / ADR 0003). Both readouts degrade gracefully
 * — when a DB isn't configured or is unreachable the probe still returns 200
 * with a field describing that state, so it never falsely reports the app as
 * down.
 */
import { readAppDbHealth } from "@/lib/db/app";
import { readNubebarDbHealth } from "@/lib/db/nubebar";

// Always evaluate at request time so the probe reflects a live server (and
// live DB connections), not a build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET() {
  const [db, nubebar] = await Promise.all([
    readAppDbHealth(),
    readNubebarDbHealth(),
  ]);
  return Response.json({ status: "ok", service: "bar-metrics", db, nubebar });
}
