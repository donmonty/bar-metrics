/**
 * Chart-ramp POC for issue #63 — "Design the orange chart ramp".
 * NOT a shipped route. Throwaway, following the `app/dev-palette-poc`
 * precedent from #62: outside `/dashboard` so middleware.ts's matcher never
 * gates it, not linked from any nav, deleted once the winning ramp is folded
 * into `app/globals.css`.
 *
 * Three candidate ramps on the four real charts, over the locked surface
 * ladder, switchable via `?ramp=A|B|C` and the floating bar (or ← / →).
 * Three orthogonal switches ride alongside, because the ticket asks four
 * questions and only one of them is the ramp:
 *
 *   ?ranked=1     bars step down the ramp by rank, instead of one flat fill
 *   ?gradient=1   the trend area gets a fading gradient, instead of flat 20%
 *   ?chrome=fixed grid + tooltip retuned for the dark ground
 *
 *   npm run dev  →  http://localhost:3000/dev-chart-ramp-poc?ramp=A
 */
import { Suspense } from "react";

import { ContrastReadout } from "./contrast-readout";
import { Gallery } from "./gallery";
import { CHROME, ChromeKey, rampFor } from "./ramps";
import { Switcher } from "./switcher";

export default async function ChartRampPocPage({
  searchParams,
}: {
  searchParams: Promise<{
    ramp?: string;
    ranked?: string;
    gradient?: string;
    chrome?: string;
  }>;
}) {
  const params = await searchParams;
  const ramp = rampFor(params.ramp);
  const ranked = params.ranked === "1";
  const gradient = params.gradient === "1";
  const chrome: ChromeKey = params.chrome === "fixed" ? "fixed" : "asIs";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-10 p-8 pb-32">
        <div className="space-y-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Chart-ramp POC · issue #63 · not a real route
          </p>
          <h1 className="text-2xl font-semibold">
            {ramp.key} — {ramp.name}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {ramp.thesis}
          </p>
          <p className="max-w-3xl border-l-2 border-l-primary pl-3 text-sm text-muted-foreground">
            The constraint all three answer to: on a{" "}
            <code className="text-foreground">--card</code> ground, an orange
            fill needs roughly <span className="text-foreground">L ≥ 0.51</span>{" "}
            to clear 3:1. There is no room below the accent to fade into, so no
            candidate descends into the dark.
          </p>
          <dl className="grid gap-x-4 gap-y-1 pt-2 text-xs sm:grid-cols-[auto_1fr]">
            <div className="contents">
              <dt className="text-muted-foreground">Ranked bars</dt>
              <dd>
                {ranked
                  ? "ON — each bar takes its own step, indexed by rank"
                  : "off — every bar on one flat --chart-1 (what ships today)"}
              </dd>
            </div>
            <div className="contents">
              <dt className="text-muted-foreground">Area fill</dt>
              <dd>
                {gradient
                  ? "gradient — 45% at the stroke fading to 2% at the axis"
                  : "flat — fillOpacity 0.2 (what ships today)"}
              </dd>
            </div>
            <div className="contents">
              <dt className="text-muted-foreground">Chrome</dt>
              <dd>{CHROME[chrome].note}</dd>
            </div>
          </dl>
        </div>

        <Gallery
          ramp={ramp}
          ranked={ranked}
          gradient={gradient}
          chrome={chrome}
        />

        <ContrastReadout ramp={ramp} chrome={chrome} />

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Tokens</h2>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            {ramp.steps
              .map((step, index) => `--chart-${index + 1}: ${step};`)
              .join("\n")}
          </pre>
        </section>
      </div>

      <Suspense fallback={null}>
        <Switcher
          current={ramp.key}
          ranked={ranked}
          gradient={gradient}
          chrome={chrome}
        />
      </Suspense>
    </div>
  );
}
