/**
 * Placeholder authenticated page (issue #11) — proves the magic-link round
 * trip without a real dashboard yet. `middleware.ts` redirects unauthenticated
 * visits here to `/login`, so `auth()` is non-null whenever this renders.
 * `sucursalIds` is always `[]` in this slice (Slice 2 / issue #12 populates it).
 *
 * Styling is the shell's own idiom (issue #70): before that it was the one
 * surface in the app that could not inherit tokens — inline `style` with a
 * system font stack and not a single Tailwind class — while being live as
 * `/login`'s default `redirectTo`. It stays a placeholder; only the skin moved.
 */
import { auth } from "@/lib/auth";

export default async function MePage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Signed in</h1>
      <p className="mt-4 text-muted-foreground">
        Email: {session?.user?.email}
      </p>
      <p className="text-muted-foreground">
        Sucursal IDs: {JSON.stringify(session?.user?.sucursalIds ?? [])}
      </p>
    </main>
  );
}
