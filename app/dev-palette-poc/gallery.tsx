"use client";

/**
 * The gallery every candidate is judged on (issue #62). Throwaway.
 *
 * Deliberately built from the app's REAL components — `Card`, every `Button`
 * variant, `Input`, `Label`, `Select`, `Popover`, a header shell that mirrors
 * `components/dashboard/dashboard-header.tsx`, and a table row set matching
 * `components/tables/productos-sin-registro-table.tsx`. Judging a palette on
 * swatches is how you end up with the current theme, where `--card` and
 * `--background` differ by 0.06 L and cards vanish.
 *
 * Charts are NOT here: the orange ramp is issue #63, blocked on this one.
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Candidate } from "./palettes";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const rows = [
  {
    codigoPos: "PZ-1042",
    nombre: "Vodka Absolut 750ml",
    ocurrencias: 42,
    importe: 18400,
  },
  {
    codigoPos: "PZ-0887",
    nombre: "Ron Bacardí Blanco",
    ocurrencias: 31,
    importe: 12250,
  },
  {
    codigoPos: "PZ-2210",
    nombre: "Whisky Buchanan's 12",
    ocurrencias: 24,
    importe: 33900,
  },
  {
    codigoPos: "PZ-0431",
    nombre: "Tequila Don Julio 70",
    ocurrencias: 18,
    importe: 27600,
  },
];

const navItems = ["Ventas", "Valor de inventario", "Merma", "Sin registro"];

export function Gallery({ candidate }: { candidate: Candidate }) {
  const broad = candidate.accentBreadth === "broad";
  const numberAccent =
    candidate.accentBreadth === "narrow" ? "" : "text-primary";

  return (
    <div className="space-y-8">
      {/* --- header shell, mirroring components/dashboard/dashboard-header.tsx --- */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm">
            Últimos 30 días
          </Button>
          <Select defaultValue="centro">
            <SelectTrigger aria-label="Sucursal" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centro">Sucursal Centro</SelectItem>
              <SelectItem value="norte">Sucursal Norte</SelectItem>
              <SelectItem value="sur">Sucursal Sur</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger
              render={<Button size="sm">Preguntar a la IA</Button>}
            />
            <PopoverContent>
              <p className="text-sm">
                A popover sits on <code>--popover</code>. On a near-black ground
                it has to read as raised off the card behind it.
              </p>
              <Input placeholder="¿Cuánto vendí ayer?" />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* --- nav strip: the 'broad accent' candidates mark the active tab --- */}
      <nav className="flex flex-wrap gap-1 text-sm">
        {navItems.map((item, i) => (
          <span
            key={item}
            className={cn(
              "rounded-lg px-2.5 py-1.5",
              i === 0
                ? broad
                  ? "bg-primary/15 font-medium text-primary"
                  : "bg-muted font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {item}
          </span>
        ))}
      </nav>

      {/* --- metric cards: the surface-ladder test. Can you see the card? --- */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Ventas del periodo",
            value: currency.format(1284300),
            delta: "+12.4% vs. periodo anterior",
          },
          {
            title: "Valor de inventario",
            value: currency.format(486120),
            delta: "−3.1% vs. periodo anterior",
          },
          {
            title: "Merma",
            value: "4.8%",
            delta: "+0.6 pts vs. periodo anterior",
          },
        ].map((metric) => (
          <Card
            key={metric.title}
            className={cn(
              candidate.cardEdgeClass,
              broad && "border-l-2 border-l-primary",
            )}
          >
            <CardHeader>
              <CardDescription>{metric.title}</CardDescription>
              <CardTitle className={cn("text-2xl tabular-nums", numberAccent)}>
                {metric.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metric.delta}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* --- a card containing a table, plus a loading card beside it --- */}
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className={candidate.cardEdgeClass}>
          <CardHeader>
            <CardTitle>Productos sin registro</CardTitle>
            <CardDescription>
              Vendidos en el POS sin receta capturada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Código POS</th>
                  <th className="py-2 pr-4 font-medium">Producto</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Ocurrencias
                  </th>
                  <th className="py-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.codigoPos}>
                    <td className="py-2 pr-4 font-mono">{row.codigoPos}</td>
                    <td className="py-2 pr-4">{row.nombre}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.ocurrencias}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        broad && "font-medium text-primary",
                      )}
                    >
                      {currency.format(row.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={candidate.cardEdgeClass}>
            <CardHeader>
              <CardTitle>Cargando</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
          <Card className={candidate.cardEdgeClass}>
            <CardHeader>
              <CardTitle>Sin datos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No hay datos registrados en este periodo.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* --- every button variant, side by side, on the card ground --- */}
      <Card className={candidate.cardEdgeClass}>
        <CardHeader>
          <CardTitle>Controles</CardTitle>
          <CardDescription>
            Every `Button` variant, plus form controls. Tab through them — the
            focus ring is one of the roles up for decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="poc-input">Buscar producto</Label>
              <Input id="poc-input" placeholder="Vodka…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="poc-input-filled">Código POS</Label>
              <Input id="poc-input-filled" defaultValue="PZ-1042" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- bare page ground: not everything renders inside a card --- */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Straight on the page ground</h2>
        <p className="text-sm text-muted-foreground">
          Muted copy sitting directly on <code>--background</code>, with no card
          behind it — page descriptions and empty states do this.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm">Exportar</Button>
          <Button size="sm" variant="outline">
            Cancelar
          </Button>
        </div>
      </section>
    </div>
  );
}
