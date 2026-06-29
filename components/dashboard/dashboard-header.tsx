/**
 * Header shell rendered by `app/dashboard/layout.tsx` for every
 * `/dashboard/*` route (issue #16) — date-range control always shown, the
 * Sucursal switcher only when the User has more than one assigned Sucursal
 * (per the PRD: a single-Sucursal User doesn't need a switcher).
 */
import { ChatPanel } from "@/components/chat/chat-panel";
import { DateRangeControl } from "./date-range-control";
import { SucursalSwitcher } from "./sucursal-switcher";
import type { SucursalSummary } from "@/lib/db/nubebar";

export function DashboardHeader({
  sucursales,
}: {
  sucursales: SucursalSummary[];
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeControl />
        {sucursales.length > 1 && <SucursalSwitcher sucursales={sucursales} />}
        <ChatPanel sucursales={sucursales} />
      </div>
    </header>
  );
}
