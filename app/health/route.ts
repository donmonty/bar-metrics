/**
 * Liveness/readiness probe for the bar-metrics app.
 *
 * Deliberately does NO database access (see issue #2): it only confirms that
 * the Next.js server booted and can serve a request. The data-access slices
 * (#4 Neon app DB, #5 nubebar read-model) will own any deeper health checks.
 */

// Always evaluate at request time so the probe reflects a live server, not a
// build-time snapshot.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "bar-metrics" });
}
