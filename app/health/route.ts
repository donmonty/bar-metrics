/**
 * Liveness/readiness probe for the bar-metrics app.
 *
 * Confirms the Next.js server booted and serves a request, and surfaces
 * small readouts end to end: the `health_checks` row count from the Neon app
 * DB (issue #4 / ADR 0003), the Sucursal count from the read-only nubebar
 * read model (issue #5 / ADR 0003), and whether Auth.js + Resend are
 * configured (issue #11 / ADR 0002, no PII, no session data). Readouts
 * degrade gracefully — when something isn't configured or is unreachable the
 * probe still returns 200 with a field describing that state, so it never
 * falsely reports the app as down.
 */
import { isAuthConfigured, isResendConfigured } from "@/lib/auth";
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
  const auth = {
    configured: isAuthConfigured(),
    resendConfigured: isResendConfigured(),
  };
  return Response.json({
    status: "ok",
    service: "bar-metrics",
    db,
    nubebar,
    auth,
  });
}
