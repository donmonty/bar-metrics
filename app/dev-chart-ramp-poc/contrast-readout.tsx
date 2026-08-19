"use client";

/**
 * Live WCAG readout for the ramp on screen (issue #63). Throwaway.
 *
 * Uses the shipped harness math (`lib/theme/contrast`), so a ratio here is
 * the number `npm run check:contrast` will print once the winner lands in
 * `app/globals.css`. Adds two rows the shipped harness does NOT assert yet
 * and that this ticket puts up for decision: the fill against `--background`
 * (charts rendered outside a card) and the grid line, which is decorative
 * under WCAG but invisible in practice at the shipped 4%.
 */

import { contrastRatio, oklchToRgb, parseOklch } from "@/lib/theme/contrast";
import { AA_NON_TEXT } from "@/lib/theme/contrast-pairs";
import { CHROME, ChromeKey, Ramp } from "./ramps";

const CARD = "oklch(0.185 0.008 240)";
const BACKGROUND = "oklch(0.115 0.008 240)";

function ratio(fg: string, bg: string): number {
  return contrastRatio(oklchToRgb(parseOklch(fg)), oklchToRgb(parseOklch(bg)));
}

export function ContrastReadout({
  ramp,
  chrome,
}: {
  ramp: Ramp;
  chrome: ChromeKey;
}) {
  const rows = ramp.steps.map((step, index) => ({
    label: `chart-${index + 1} fill`,
    value: step,
    onCard: ratio(step, CARD),
    onPage: ratio(step, BACKGROUND),
  }));

  const failures = rows.filter((row) => row.onCard < AA_NON_TEXT).length;

  /** Step-to-step ΔL, the separation the eye actually uses on a thin bar. */
  const deltas = ramp.steps.slice(1).map((step, index) => {
    const previous = parseOklch(ramp.steps[index]!);
    const current = parseOklch(step);
    return {
      l: current.l - previous.l,
      c: current.c - previous.c,
    };
  });

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-medium">Contrast</h2>
        <span
          className={
            failures === 0
              ? "text-xs text-muted-foreground"
              : "text-xs font-medium text-destructive"
          }
        >
          {failures === 0
            ? `all 5 steps clear ${AA_NON_TEXT}:1 on a card`
            : `${failures} step(s) below ${AA_NON_TEXT}:1 on a card`}
        </span>
      </div>

      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr className="text-left">
            <th className="py-1 font-normal">step</th>
            <th className="py-1 font-normal">value</th>
            <th className="py-1 font-normal">on --card</th>
            <th className="py-1 font-normal">on --background</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="py-1">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-sm"
                    style={{ background: row.value }}
                  />
                  {row.label}
                </span>
              </td>
              <td className="py-1 text-muted-foreground">{row.value}</td>
              <td
                className={
                  row.onCard < AA_NON_TEXT ? "py-1 text-destructive" : "py-1"
                }
              >
                {row.onCard.toFixed(2)}
                {row.onCard < AA_NON_TEXT ? " FAIL" : ""}
              </td>
              <td className="py-1 text-muted-foreground">
                {row.onPage.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-muted-foreground">
        Step-to-step:{" "}
        {deltas
          .map(
            (delta, index) =>
              `${index + 1}→${index + 2} ΔL ${delta.l >= 0 ? "+" : ""}${delta.l.toFixed(3)}, ΔC ${delta.c >= 0 ? "+" : ""}${delta.c.toFixed(3)}`,
          )
          .join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        Chrome — {CHROME[chrome].name}: {CHROME[chrome].note} Grid lines are
        decorative under WCAG, so no ratio is asserted; the question is whether
        you can see them.
      </p>
    </section>
  );
}
