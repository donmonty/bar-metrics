/**
 * `/dashboard` shell (issue #16) — every metric slice (#17-#21) renders
 * inside this layout's `children`. Resolves the signed-in User's Sucursal
 * scope once here (via `lib/auth`'s session, never a client-supplied value)
 * and either shows the account-level "no Sucursal assigned" message or the
 * filter header + page content. `middleware.ts` guarantees `auth()` is
 * non-null whenever this renders.
 */
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";
import { findSucursalesByIds } from "@/lib/db/nubebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const sucursalIds = session?.user?.sucursalIds ?? [];

  if (sucursalIds.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground">
          Tu cuenta no tiene ninguna Sucursal asignada todavía. Contacta a un
          administrador para que te asigne al menos una.
        </p>
      </main>
    );
  }

  const sucursales = await findSucursalesByIds(sucursalIds);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <DashboardHeader sucursales={sucursales} />
      <main className="mt-6">{children}</main>
    </div>
  );
}
