/**
 * The foreground/background pairs the palette is held to, and the WCAG AA
 * threshold each one has to clear.
 *
 * Not every token combination — only the ones a reader actually meets on
 * screen. Asserting the full cross product would bury the real failures in
 * pairs that never render together.
 */

import { tokenContrast, type Wash } from "./contrast";
import { token, type TokenSet } from "./tokens";

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and graphical objects. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export type ContrastPair = {
  /** What the pair is, in reader terms — used in the assertion message. */
  label: string;
  foreground: string;
  background: string;
  minimum: number;
  /**
   * Set when the background is not the token itself but a translucent wash of
   * it — `bg-<token>/<alpha>` — over an opaque surface. Scored on the
   * composite, since that is the colour the reader meets.
   */
  wash?: Wash;
};

/**
 * Score one pair against a token set. The suite and `check:contrast` both go
 * through here so a wash can't be composited one way in the assertion and
 * another way in the report.
 */
export function scorePair(tokens: TokenSet, pair: ContrastPair): number {
  return tokenContrast(
    token(tokens, pair.foreground),
    token(tokens, pair.background),
    pair.wash && {
      alpha: pair.wash.alpha,
      over: token(tokens, pair.wash.over),
    },
  );
}

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
    label: "muted text on a card",
    foreground: "--muted-foreground",
    background: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "text on a primary button",
    foreground: "--primary-foreground",
    background: "--primary",
    minimum: AA_TEXT,
  },
  {
    label: "text on a popover",
    foreground: "--popover-foreground",
    background: "--popover",
    minimum: AA_TEXT,
  },
  // Orange carries meaning as text, not just as a button fill (issue #62
  // gave the accent to headline numbers), so it is held to the text floor.
  //
  // Both grounds, for the reason #67 gave when it graduated the chart fills:
  // `StockValueSummary` — the only component that spends the accent this way —
  // renders inside a `Card` on the landing page and straight on the page at
  // `/dashboard/stock-value`, and the PAGE is the ground this file used to
  // miss. 5.88:1 on a card, 6.44:1 on the page.
  {
    label: "orange as a number on a card",
    foreground: "--primary",
    background: "--card",
    minimum: AA_TEXT,
  },
  {
    label: "orange as a number on the page",
    foreground: "--primary",
    background: "--background",
    minimum: AA_TEXT,
  },
  // WCAG 1.4.11 asks 3:1 of anything identifying a CONTROL's boundary.
  // `--input` is exactly that — `Input`, `SelectTrigger`, and in dark mode the
  // `outline` Button, which switches to `dark:border-input`. `--border` is
  // deliberately NOT asserted: it draws the app's edges — cards, popovers,
  // select menus — which are decorative, and holding it to 3:1 would demand a
  // near-white hairline on every card. That distinction is issue #62's call.
  //
  // Since issue #69 that list no longer includes the header rule and the table
  // dividers: those moved to `--rule` at 15%, because "quiet enough to keep
  // the ladder edgeless" and "loud enough to divide content" cannot be the
  // same number. `--rule` is unasserted for the SAME reason `--border` is —
  // it identifies no control, and #69 measured the 3:1 floor on these grounds
  // at ~34% white, which is `--input`'s weight. Splitting the token moved the
  // rules where a reader can see them; it did not create a WCAG obligation.
  //
  // Since issue #66 that list is literal, not aspirational: `Card`,
  // `PopoverContent` and `SelectContent` used to draw their own edge with a
  // hardcoded `ring-1 ring-foreground/10` (10% white, 1.29:1 on `--card`) that
  // no token could reach. They now carry `ring-1 ring-border`, so every edge in
  // the app resolves here and the ladder stays the only real separator. Do not
  // add a `--border` pair to "fix" the faint result — 1.23:1 is the intended
  // look, and asserting 3:1 would force back the visible edge #62 rejected.
  {
    label: "input boundary on a card",
    foreground: "--input",
    background: "--card",
    minimum: AA_NON_TEXT,
  },
  {
    label: "input boundary on the page",
    foreground: "--input",
    background: "--background",
    minimum: AA_NON_TEXT,
  },
  {
    label: "focus ring on the page",
    foreground: "--ring",
    background: "--background",
    minimum: AA_NON_TEXT,
  },
  {
    label: "focus ring on a card",
    foreground: "--ring",
    background: "--card",
    minimum: AA_NON_TEXT,
  },
  // Chart fills are graphical objects, so they sit in the 3:1 bucket. Both
  // grounds are real and both are asserted: issue #64's inventory found that
  // `Card` renders on only two pages, so all four drill-down pages put their
  // charts straight on `--background` — the page is the COMMON case, the card
  // the exception. #63 measured the ramp against both; these ten pairs are
  // that measurement made standing.
  ...CHART_TOKENS.flatMap((chart) => [
    {
      label: `${chart.replace("--", "")} fill on a card`,
      foreground: chart,
      background: "--card",
      minimum: AA_NON_TEXT,
    },
    {
      label: `${chart.replace("--", "")} fill on the page`,
      foreground: chart,
      background: "--background",
      minimum: AA_NON_TEXT,
    },
  ]),
  // The chat panel (issue #68). Its message list is a WELL: the list drops to
  // `--card` while the panel's own chrome stays at `--popover`, so both bubble
  // kinds rise off a ground one rung below them instead of sitting 0.04 from
  // the sheet they're on. That makes `--muted` and the orange wash into
  // backgrounds for the first time, which is what these two pairs assert.
  //
  // Note the well itself is NOT asserted against the panel: surface-vs-surface
  // this far down the scale compresses to nothing as a WCAG ratio (the well
  // reads 1.09:1 on the panel, the assistant bubble 1.22:1 on the well) — the
  // same measurement trap #67 hit with `--overlay`. The separation that matters
  // was measured as a luminance ratio and lives in the ticket; what WCAG has an
  // opinion about is the text, which is what sits here.
  {
    label: "text in an assistant chat bubble",
    foreground: "--foreground",
    background: "--muted",
    minimum: AA_TEXT,
  },
  // The user bubble is the accent at a fraction of its weight, not a slab of
  // it: `bg-primary/20` over the well, with an opaque `--primary` left rule.
  // #62 rationed the accent to `--primary`, `--ring` and one headline number,
  // and a solid `bg-primary` bubble — which is what this was — made a long
  // user message the loudest orange surface in the app.
  //
  // The rule itself needs no pair of its own: `--primary` on `--card` is
  // already asserted above as "orange as a number on a card".
  {
    label: "text in a user chat bubble",
    foreground: "--foreground",
    background: "--primary",
    wash: { alpha: 0.2, over: "--card" },
    minimum: AA_TEXT,
  },
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
  // Empty, and worth keeping empty. The three chart-ramp entries that lived
  // here left by passing: issue #63's Ember ramp scores 3.65 / 4.62 / 5.88 /
  // 8.07 / 11.33 on a card. A pair leaves this list by passing, never by
  // being deleted.
};
