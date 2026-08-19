"use client";

/**
 * The four real charts on the candidate ramp, issue #63. Throwaway.
 *
 * Each is rendered inside a real `<Card>` on the locked surface ladder, which
 * is the only ground the 3:1 floor is measured against. The candidate ramp is
 * applied by setting `--chart-1..5` inline on the wrapper — it beats `.dark`
 * for this subtree, so nothing here touches the shipped tokens.
 *
 * `ranked` / `gradient` swap the SHIPPED component for the prototype copy in
 * `ramped-charts.tsx`; with both off, what is on screen is literally the app.
 */

import { MermaChart } from "@/components/charts/merma-chart";
import { SalesTrendChart } from "@/components/charts/sales-trend-chart";
import { StockValueSummary } from "@/components/charts/stock-value-summary";
import { TopRecetasChart } from "@/components/charts/top-recetas-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GradientAreaChart, RampedBarChart } from "./ramped-charts";
import {
  CHROME,
  ChromeKey,
  MERMA_DATA,
  RECETAS_DATA,
  STOCK_BREAKDOWN,
  STOCK_TOTAL,
  TREND_DATA,
  Ramp,
  rampTokens,
} from "./ramps";

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Gallery({
  ramp,
  ranked,
  gradient,
  chrome,
}: {
  ramp: Ramp;
  ranked: boolean;
  gradient: boolean;
  chrome: ChromeKey;
}) {
  const chromeValues = CHROME[chrome];

  return (
    <div
      data-poc-chrome
      style={
        {
          ...rampTokens(ramp),
          "--poc-grid": chromeValues.grid,
          "--poc-tooltip-bg": chromeValues.tooltipBg,
          "--poc-tooltip-border": chromeValues.tooltipBorder,
        } as React.CSSProperties
      }
      className="space-y-6"
    >
      {/* Chrome overrides. The shipped values live inside `ChartContainer`'s
          arbitrary-variant class string and the tooltip's own classes, so a
          prototype can only reach them from outside. */}
      <style>{`
        [data-poc-chrome] .recharts-cartesian-grid line { stroke: var(--poc-grid); }
        [data-poc-chrome] .recharts-tooltip-wrapper > div {
          background: var(--poc-tooltip-bg) !important;
          border-color: var(--poc-tooltip-border) !important;
        }
      `}</style>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Merma por ingrediente"
          description="Ranked bars — the signature chart. Eight rows shown; the real page caps at 15."
        >
          {ranked ? (
            <RampedBarChart
              data={MERMA_DATA}
              categoryKey="ingrediente"
              valueKey="porcentaje"
              config={{ porcentaje: { label: "Merma %" } }}
              tooltip={(value, _name, item) => [
                `${Number(value).toFixed(1)}% (${(item.payload as { deltaMl: number }).deltaMl.toFixed(1)} mL)`,
                "Merma",
              ]}
            />
          ) : (
            <MermaChart data={MERMA_DATA} emptyMessage="Sin datos." />
          )}
        </ChartCard>

        <ChartCard
          title="Top recetas por ingresos"
          description="The same ranked-bar shape, different units — whatever wins has to hold on both."
        >
          {ranked ? (
            <RampedBarChart
              data={RECETAS_DATA}
              categoryKey="receta"
              valueKey="importe"
              config={{ importe: { label: "Ingresos" } }}
              tooltip={(value, _name, item) => [
                `$${Number(value).toLocaleString("es-MX")} (${(item.payload as { unidades: number }).unidades} u)`,
                "Ingresos",
              ]}
            />
          ) : (
            <TopRecetasChart data={RECETAS_DATA} emptyMessage="Sin datos." />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Tendencia de ingresos"
        description="The only filled area in the app. Stroke plus fill — flat opacity, or a gradient fading down."
      >
        {gradient ? (
          <GradientAreaChart
            data={TREND_DATA}
            config={{ importe: { label: "Ingresos", color: "var(--chart-1)" } }}
          />
        ) : (
          <SalesTrendChart data={TREND_DATA} emptyMessage="Sin datos." />
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Valor de inventario"
          description="No Recharts here — a headline number and a two-row split. It borrows --primary, not the ramp."
        >
          <StockValueSummary total={STOCK_TOTAL} breakdown={STOCK_BREAKDOWN} />
        </ChartCard>

        <ChartCard
          title="The ramp itself"
          description="Five steps on the card ground, in order. Step-to-step separation is the thing to judge."
        >
          <div className="space-y-3">
            <div className="flex h-16 overflow-hidden rounded-lg">
              {ramp.steps.map((step, index) => (
                <div
                  key={step}
                  className="flex-1"
                  style={{ background: `var(--chart-${index + 1})` }}
                  title={step}
                />
              ))}
            </div>
            <div className="flex h-6 items-end gap-1">
              {ramp.steps.map((step, index) => (
                <div
                  key={step}
                  className="flex-1 rounded-sm"
                  style={{
                    background: `var(--chart-${index + 1})`,
                    height: 8,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Thin strips are the honest test — a bar is 8&nbsp;px tall, not 64.
              The accent sits at step {ramp.accentStep}.
            </p>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
