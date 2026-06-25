/**
 * Sucursal switcher for the dashboard shell (issue #16) — only rendered by
 * `DashboardHeader` when the User has more than one assigned Sucursal. Writes
 * the User's *choice* to the `sucursal` URL param; the page layer is what
 * actually re-validates that choice against `session.user.sucursalIds`
 * (`lib/dashboard/filters.resolveSucursalId`) before trusting it — this
 * component never bypasses that.
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { resolveSucursalId } from "@/lib/dashboard/filters";
import type { SucursalSummary } from "@/lib/db/nubebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SucursalSwitcher({
  sucursales,
}: {
  sucursales: SucursalSummary[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sucursalIds = sucursales.map((s) => s.id);
  const current = resolveSucursalId(
    sucursalIds,
    searchParams.get("sucursal") ?? undefined,
  );

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sucursal", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current === null ? null : String(current)} onValueChange={handleChange}>
      <SelectTrigger aria-label="Sucursal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sucursales.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
