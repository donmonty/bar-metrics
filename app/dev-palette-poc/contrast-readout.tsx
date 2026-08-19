"use client";

/**
 * Live WCAG readout for the candidate on screen (issue #62). Throwaway.
 *
 * Uses the shipped harness math (`lib/theme/contrast`) rather than its own,
 * so a ratio here is the same number `npm run check:contrast` will print once
 * the winner is folded into `app/globals.css`. It can't use
 * `lib/theme/tokens` — that reads globals.css off disk; candidates only exist
 * in memory until one wins.
 *
 * The pair list is the shipped one PLUS the pairs this ticket puts up for
 * decision — surface edges and orange-as-text — which the harness doesn't
 * assert yet. Whether they graduate into `CONTRAST_PAIRS` is rollout's call
 * (map: "Harness coverage at rollout").
 */

import { tokenContrast } from "@/lib/theme/contrast";
import { AA_NON_TEXT, AA_TEXT } from "@/lib/theme/contrast-pairs";
import type { Candidate } from "./palettes";

type Row = {
  label: string;
  /** A token name (`--primary`) or a literal oklch string. */
  fg: string;
  bg: string;
  minimum: number;
  /** Informational rows are scored and shown but never marked FAIL. */
  advisory?: boolean;
  /**
   * Scored and marked pass/fail, but kept out of the tally — it's a check on
   * the reference's own choice, not on this candidate's.
   */
  reference?: boolean;
};

const ROWS: Row[] = [
  // --- what the shipped harness already asserts ---
  {
    label: "body text on the page",
    fg: "--foreground",
    bg: "--background",
    minimum: AA_TEXT,
  },
  {
    label: "muted text on the page",
    fg: "--muted-foreground",
    bg: "--background",
    minimum: AA_TEXT,
  },
  {
    label: "text on a card",
    fg: "--card-foreground",
    bg: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "muted text on a card",
    fg: "--muted-foreground",
    bg: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "text on a primary button",
    fg: "--primary-foreground",
    bg: "--primary",
    minimum: AA_TEXT,
  },
  {
    label: "text on a popover",
    fg: "--popover-foreground",
    bg: "--popover",
    minimum: AA_TEXT,
  },

  // --- what this ticket decides: can you see the edge? ---
  {
    label: "border on the page",
    fg: "--border",
    bg: "--background",
    minimum: AA_NON_TEXT,
  },
  {
    label: "border on a card",
    fg: "--border",
    bg: "--card",
    minimum: AA_NON_TEXT,
  },
  {
    label: "input outline on a card",
    fg: "--input",
    bg: "--card",
    minimum: AA_NON_TEXT,
  },
  {
    label: "focus ring on the page",
    fg: "--ring",
    bg: "--background",
    minimum: AA_NON_TEXT,
  },

  // --- what this ticket decides: orange carrying meaning as text ---
  {
    label: "orange as a number on a card",
    fg: "--primary",
    bg: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "orange as text on the page",
    fg: "--primary",
    bg: "--background",
    minimum: AA_TEXT,
  },

  // --- what the reference itself does, scored for comparison ---
  // RentEngine's "Request a Demo" CTA is white on the orange. Whether we can
  // follow it is exactly the --primary-foreground half of this ticket.
  {
    label: "white text on the primary button — the reference's own CTA",
    fg: "oklch(1 0 0)",
    bg: "--primary",
    minimum: AA_TEXT,
    reference: true,
  },

  // --- advisory: the surface ladder's own steps ---
  {
    label: "card against the page ground",
    fg: "--card",
    bg: "--background",
    minimum: 1.2,
    advisory: true,
  },
  {
    label: "popover against a card",
    fg: "--popover",
    bg: "--card",
    minimum: 1.2,
    advisory: true,
  },
];

export function ContrastReadout({ candidate }: { candidate: Candidate }) {
  const resolve = (value: string) =>
    value.startsWith("--") ? candidate.tokens[value] : value;

  const scored = ROWS.map((row) => {
    const fg = resolve(row.fg);
    const bg = resolve(row.bg);
    if (!fg || !bg) return { ...row, ratio: null, passes: false };
    const ratio = tokenContrast(fg, bg);
    return { ...row, ratio, passes: ratio >= row.minimum };
  });

  const asserted = scored.filter((r) => !r.advisory && !r.reference);
  const failures = asserted.filter((r) => !r.passes).length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-medium">Contrast</h2>
        <span
          className={
            failures === 0
              ? "text-xs text-emerald-400"
              : "text-xs font-medium text-red-400"
          }
        >
          {asserted.length - failures}/{asserted.length} asserted pairs pass
          {failures > 0 && ` — ${failures} FAIL`}
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-border">
          {scored.map((row) => (
            <tr key={row.label}>
              <td className="py-1.5 pr-3">
                <span
                  className={
                    row.advisory
                      ? "text-muted-foreground"
                      : row.passes
                        ? "text-emerald-400"
                        : "font-medium text-red-400"
                  }
                >
                  {row.advisory
                    ? "····"
                    : row.reference
                      ? row.passes
                        ? "REF ok"
                        : "REF ✗"
                      : row.passes
                        ? "PASS"
                        : "FAIL"}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                {row.ratio === null ? "—" : `${row.ratio.toFixed(2)}:1`}
              </td>
              <td className="py-1.5 pr-3 text-muted-foreground">
                {row.advisory ? "" : `needs ${row.minimum}`}
              </td>
              <td className="py-1.5">{row.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        Rows marked ···· are the surface ladder&apos;s own steps — not a WCAG
        requirement, just &ldquo;is there enough separation to see an
        edge&rdquo;. Anything under ~1.2 reads as one flat surface.
      </p>
    </section>
  );
}
