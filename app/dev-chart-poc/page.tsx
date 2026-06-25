/**
 * Scaffolding for issue #23, NOT a shipped feature. Demonstrates the
 * RankedBarChart POC's loading/data/empty states side by side for manual
 * verification. Deliberately lives outside /dashboard (not covered by
 * middleware.ts's matcher, no auth gate) and is not linked from any nav.
 * Safe to delete once #17-#20 land and the conventions are no longer in
 * question.
 *
 * Named `dev-chart-poc`, not `_dev/chart-poc` — Next.js App Router treats
 * `_`-prefixed folders as private (excluded from routing), which 404s.
 */
import {
  RankedBarChart,
  RankedBarChartSkeleton,
} from "@/components/charts/ranked-bar-chart";

const fakeData = [
  { label: "Vodka", value: 842 },
  { label: "Ron", value: 611 },
  { label: "Whisky", value: 530 },
  { label: "Tequila", value: 410 },
  { label: "Gin", value: 298 },
];

export default function ChartPocPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8">
      <h1 className="text-lg font-medium">
        Chart foundation POC (issue #23, not a real route)
      </h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Loading skeleton
        </h2>
        <RankedBarChartSkeleton />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          With data (theming + tooltip)
        </h2>
        <RankedBarChart data={fakeData} emptyMessage="Sin datos." />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Empty state
        </h2>
        <RankedBarChart
          data={[]}
          emptyMessage="No hay datos registrados en este periodo."
        />
      </section>
    </div>
  );
}
