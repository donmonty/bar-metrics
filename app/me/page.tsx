/**
 * Placeholder authenticated page (issue #11) — proves the magic-link round
 * trip without a real dashboard yet. `middleware.ts` redirects unauthenticated
 * visits here to `/login`, so `auth()` is non-null whenever this renders.
 * `sucursalIds` is always `[]` in this slice (Slice 2 / issue #12 populates it).
 */
import { auth } from "@/lib/auth";

export default async function MePage() {
  const session = await auth();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Signed in</h1>
      <p>Email: {session?.user?.email}</p>
      <p>Sucursal IDs: {JSON.stringify(session?.user?.sucursalIds ?? [])}</p>
    </main>
  );
}
