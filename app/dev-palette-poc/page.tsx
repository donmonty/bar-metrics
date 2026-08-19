/**
 * Palette POC for issue #62 — "Pin the brand orange and the surface ladder".
 * NOT a shipped route. Throwaway, following the `app/dev-chart-poc/page.tsx`
 * precedent: outside `/dashboard` so middleware.ts's matcher never gates it,
 * not linked from any nav, deleted once the winning palette is folded into
 * `app/globals.css`.
 *
 * Three candidate palettes on one route, switchable via `?variant=A|B|C` and
 * the floating bar (or ← / → keys). Each candidate is applied by setting the
 * theme custom properties inline on a wrapper, which beats `.dark` for that
 * subtree — so nothing here touches the real tokens.
 *
 *   npm run dev  →  http://localhost:3000/dev-palette-poc?variant=A
 */
import { Suspense } from "react";

import { ContrastReadout } from "./contrast-readout";
import { Gallery } from "./gallery";
import {
  FOREGROUNDS,
  accentFor,
  candidateFor,
  withAccent,
  withOptions,
} from "./palettes";
import { VariantSwitcher } from "./variant-switcher";

export default async function PalettePocPage({
  searchParams,
}: {
  searchParams: Promise<{
    variant?: string;
    accent?: string;
    fg?: string;
    neutral?: string;
  }>;
}) {
  const { variant, accent, fg, neutral } = await searchParams;
  const chosenAccent = accentFor(accent);
  const chosenFg = fg === "white" || fg === "black" ? fg : undefined;
  const chosenNeutral = neutral === "cool" ? "cool" : undefined;
  const candidate = withOptions(
    withAccent(candidateFor(variant), chosenAccent),
    { fg: chosenFg, neutral: chosenNeutral },
  );

  return (
    <div
      style={candidate.tokens as React.CSSProperties}
      className="min-h-screen bg-background text-foreground"
    >
      <div className="mx-auto max-w-5xl space-y-10 p-8 pb-28">
        <div className="space-y-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Palette POC · issue #62 · not a real route
          </p>
          <h1 className="text-2xl font-semibold">
            {candidate.key} — {candidate.name}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {candidate.thesis}
          </p>
          {chosenFg && (
            <p className="max-w-2xl border-l-2 border-l-primary pl-3 text-sm">
              <span className="font-medium">{FOREGROUNDS[chosenFg].name}:</span>{" "}
              <span className="text-muted-foreground">
                {FOREGROUNDS[chosenFg].note}
              </span>
            </p>
          )}
          {chosenNeutral && (
            <p className="max-w-2xl border-l-2 border-l-primary pl-3 text-sm">
              <span className="font-medium">Cool neutrals:</span>{" "}
              <span className="text-muted-foreground">
                Surfaces carry oklch chroma 0.008 at hue 240, as the
                reference&apos;s ground does. Text stays chroma-0.
              </span>
            </p>
          )}
          {chosenAccent && (
            <p className="max-w-2xl border-l-2 border-l-primary pl-3 text-sm">
              <span className="font-medium">
                Accent override — {chosenAccent.name}:
              </span>{" "}
              <span className="text-muted-foreground">{chosenAccent.note}</span>
            </p>
          )}
          <dl className="grid gap-x-4 gap-y-1 pt-2 text-xs sm:grid-cols-[auto_1fr]">
            {(
              [
                ["Card edge", candidate.axes.edge],
                ["Accent breadth", candidate.axes.accent],
                ["Ground depth", candidate.axes.ground],
              ] as const
            ).map(([term, detail]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Gallery candidate={candidate} />

        <ContrastReadout candidate={candidate} />

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Tokens</h2>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            {Object.entries(candidate.tokens)
              .map(([name, value]) => `${name}: ${value};`)
              .join("\n")}
          </pre>
        </section>
      </div>

      <Suspense fallback={null}>
        <VariantSwitcher
          current={candidate.key}
          accent={chosenAccent?.key}
          fg={chosenFg}
          neutral={chosenNeutral}
        />
      </Suspense>
    </div>
  );
}
