/**
 * Candidate chart ramps for issue #63 — "Design the orange chart ramp".
 * Throwaway; deleted once the winner is folded into `app/globals.css`.
 *
 * The hard constraint, measured before any candidate was drawn: a chart fill
 * is a graphical object, so it owes 3:1 against the ground it sits on, and
 * the ground is `--card` at oklch(0.185 0.008 240). For hue 38 that puts a
 * LIGHTNESS FLOOR at roughly L 0.51 — oklch(0.50 0.10 38) scores 2.98,
 * oklch(0.55 0.10 38) scores 3.67. Chroma barely moves the number.
 *
 * That kills the obvious ramp. On a dark ground you cannot fade a series out
 * by going darker; every legal step lives at or above the accent's own
 * neighbourhood. So the three candidates disagree about which direction is
 * left: widen across the whole legal lightness band, hold lightness still and
 * fade CHROMA instead, or run upward from the accent into pale amber.
 *
 * Chroma values are kept under the sRGB ceiling for their lightness at hue 38
 * (L 0.55 → 0.234, L 0.678 → 0.212, L 0.80 → 0.116, L 0.90 → 0.052). Over the
 * ceiling and the browser silently clamps a candidate into a duller one.
 */

export const ACCENT = "oklch(0.678 0.208 38)";

export type Ramp = {
  key: string;
  name: string;
  thesis: string;
  /** Where the locked accent sits in the ramp, 1-indexed. */
  accentStep: number;
  steps: [string, string, string, string, string];
};

export const RAMPS: Ramp[] = [
  {
    key: "A",
    name: "Ember",
    thesis:
      "Use the whole legal lightness band, accent in the middle. Widest step-to-step separation of the three — step 1 is a deep burnt orange sitting just above the 3:1 floor, step 5 is near-white amber. Costs: the accent is no longer the loudest thing in the chart, and the pale end competes with foreground text for attention.",
    accentStep: 3,
    steps: [
      "oklch(0.555 0.16 38)",
      "oklch(0.615 0.185 38)",
      ACCENT,
      "oklch(0.755 0.145 38)",
      "oklch(0.845 0.08 38)",
    ],
  },
  {
    key: "B",
    name: "Ash",
    thesis:
      "Hold lightness almost still and fade chroma instead: saturated orange to warm grey, every step landing between 5.0 and 5.9 against the card. Nothing can fail AA and nothing competes with text. Costs: separation is by colourfulness alone, which is the weakest channel at bar-width, and steps 4-5 stop reading as brand colour at all.",
    accentStep: 1,
    steps: [
      ACCENT,
      "oklch(0.66 0.15 38)",
      "oklch(0.645 0.10 38)",
      "oklch(0.63 0.055 38)",
      "oklch(0.62 0.02 38)",
    ],
  },
  {
    key: "C",
    name: "Dawn",
    thesis:
      "Accent at step 1, running upward into pale amber, chroma tracking the sRGB ceiling down as lightness rises. The accent stays the loudest step, which is what a ranked chart wants at rank 1. Costs: 'later' steps get physically brighter (14:1 by step 5), so a long ranked chart ends louder than it starts.",
    accentStep: 1,
    steps: [
      ACCENT,
      "oklch(0.735 0.165 38)",
      "oklch(0.79 0.115 38)",
      "oklch(0.85 0.078 38)",
      "oklch(0.91 0.045 38)",
    ],
  },
];

export function rampFor(key: string | undefined): Ramp {
  return RAMPS.find((ramp) => ramp.key === key?.toUpperCase()) ?? RAMPS[0]!;
}

/** The candidate's five steps as the `--chart-N` custom properties. */
export function rampTokens(ramp: Ramp): Record<string, string> {
  return Object.fromEntries(
    ramp.steps.map((step, index) => [`--chart-${index + 1}`, step]),
  );
}

/**
 * Chart chrome as it ships today, and what each piece would become. Both
 * numbers are real: `--border` is oklch(1 0 0 / 8%), and `ChartContainer`
 * draws grid lines at `stroke-border/50` — 4% white on a 0.185 card, which
 * is a grid you cannot see. The tooltip is `bg-background` (0.115), DARKER
 * than the card it floats over, inverting the surface ladder #62 locked.
 */
export const CHROME = {
  asIs: {
    name: "as it ships",
    grid: "color-mix(in oklab, white 4%, transparent)",
    tooltipBg: "oklch(0.115 0.008 240)",
    tooltipBorder: "color-mix(in oklab, white 4%, transparent)",
    note: "Grid at border/50 = 4% white; tooltip on --background, below the card in the ladder.",
  },
  fixed: {
    name: "retuned for the dark ground",
    grid: "color-mix(in oklab, white 10%, transparent)",
    tooltipBg: "oklch(0.225 0.008 240)",
    tooltipBorder: "color-mix(in oklab, white 14%, transparent)",
    note: "Grid raised to 10% white; tooltip moved onto --popover (0.225), which is the rung ABOVE the card.",
  },
} as const;

export type ChromeKey = keyof typeof CHROME;

// --- sample data, shaped like the real queries -------------------------------

export const MERMA_DATA = [
  { ingrediente: "Tequila Blanco", porcentaje: 18.4, deltaMl: -412.5 },
  { ingrediente: "Vodka Absolut", porcentaje: 14.1, deltaMl: -333.0 },
  { ingrediente: "Ginebra Tanqueray", porcentaje: 11.7, deltaMl: -280.2 },
  { ingrediente: "Ron Bacardí Blanco", porcentaje: 9.3, deltaMl: -201.8 },
  { ingrediente: "Whisky Buchanan's 12", porcentaje: 7.8, deltaMl: -166.4 },
  { ingrediente: "Mezcal Espadín", porcentaje: 6.2, deltaMl: -140.0 },
  { ingrediente: "Licor de Café", porcentaje: 4.9, deltaMl: -98.6 },
  { ingrediente: "Vermouth Rosso", porcentaje: 3.1, deltaMl: -60.2 },
];

export const RECETAS_DATA = [
  { receta: "Margarita Clásica", importe: 48200, unidades: 964 },
  { receta: "Paloma", importe: 39750, unidades: 883 },
  { receta: "Mojito", importe: 31400, unidades: 628 },
  { receta: "Gin Tonic", importe: 27900, unidades: 465 },
  { receta: "Michelada", importe: 21300, unidades: 710 },
  { receta: "Negroni", importe: 16800, unidades: 240 },
  { receta: "Carajillo", importe: 12450, unidades: 415 },
  { receta: "Old Fashioned", importe: 9600, unidades: 120 },
];

export const TREND_DATA = Array.from({ length: 21 }, (_, index) => {
  const day = index + 1;
  const base = 9000 + Math.sin(index / 2.3) * 2600 + index * 190;
  return {
    fecha: `${String(day).padStart(2, "0")} ago`,
    importe: Math.round(base + (day % 7 === 0 ? 4200 : 0)),
  };
});

export const STOCK_TOTAL = 486_300;
export const STOCK_BREAKDOWN = [
  { tipo: "Barra" as const, valor: 138_900 },
  { tipo: "Bodega" as const, valor: 347_400 },
];
