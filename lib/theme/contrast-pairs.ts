/**
 * The foreground/background pairs the palette is held to, and the WCAG AA
 * threshold each one has to clear.
 *
 * Not every token combination — only the ones a reader actually meets on
 * screen. Asserting the full cross product would bury the real failures in
 * pairs that never render together.
 */

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and graphical objects. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export type ContrastPair = {
  /** What the pair is, in reader terms — used in the assertion message. */
  label: string;
  foreground: string;
  background: string;
  minimum: number;
};

const CHART_TOKENS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

export const CONTRAST_PAIRS: ContrastPair[] = [
  {
    label: "body text on the page",
    foreground: "--foreground",
    background: "--background",
    minimum: AA_TEXT,
  },
  {
    label: "muted text on the page",
    foreground: "--muted-foreground",
    background: "--background",
    minimum: AA_TEXT,
  },
  {
    label: "text on a card",
    foreground: "--card-foreground",
    background: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "text on a primary button",
    foreground: "--primary-foreground",
    background: "--primary",
    minimum: AA_TEXT,
  },
  // Chart fills are graphical objects, so they sit in the 3:1 bucket. Charts
  // render inside cards, which is the ground they have to stand out from.
  ...CHART_TOKENS.map((chart) => ({
    label: `${chart.replace("--", "")} fill on a card`,
    foreground: chart,
    background: "--card",
    minimum: AA_NON_TEXT,
  })),
];

/**
 * Pairs the current palette is known to fail, each pointing at the ticket that
 * fixes it. The harness reports these instead of asserting them, so it can
 * land green on a palette it was built to condemn.
 *
 * Emptying this list is part of the definition of done for the tickets named
 * here — a pair leaves the list by passing, never by being deleted.
 */
export const KNOWN_FAILURES: Record<string, string> = {
  // The shipped dark ramp is shadcn's neutral greys, which collapse into the
  // card surface. The orange ramp that replaces them is issue #63.
  "chart-3 fill on a card": "#63 — orange chart ramp",
  "chart-4 fill on a card": "#63 — orange chart ramp",
  "chart-5 fill on a card": "#63 — orange chart ramp",
};
