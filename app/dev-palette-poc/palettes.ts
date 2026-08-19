/**
 * Candidate palettes for issue #62 — NOT shipped tokens. Throwaway, lives
 * only on the `wayfinder/62-brand-orange-surface-ladder` branch; the winner
 * gets folded into `app/globals.css` by hand and this directory is deleted.
 *
 * Named `dev-palette-poc`, not `_dev/palette-poc`, for the same reason
 * `app/dev-chart-poc` is: Next.js treats `_`-prefixed folders as private and
 * 404s them. Outside `/dashboard`, so middleware.ts's matcher never sees it.
 *
 * Each candidate is a coherent *position* on the three axes the ticket puts
 * up for decision, not a random cross of them:
 *
 *   - card edge     — separation from lightness alone, or lightness + a
 *                     visible edge (`Card` ships `ring-1 ring-foreground/10`,
 *                     which is all but invisible on a near-black ground)
 *   - accent breadth— which roles actually get orange
 *   - ground depth  — how dark the page ground goes, how far the ladder climbs
 *
 * Neutral warmth is deliberately NOT an axis here: it was settled as chroma-0
 * (matching today's greys) rather than put to the eye.
 */

/**
 * The reference orange, sampled off the RentEngine front page: the "More
 * leases." headline and the "Request a Demo" CTA both sit at ~#FC5A1E, which
 * is `oklch(0.678 0.208 38)`. Distinctly red-leaning — hue 38, not the ~47 of
 * a generic Tailwind orange.
 *
 * Every candidate retunes THIS hue rather than inventing its own family: they
 * disagree about how bright and how saturated it has to be to survive a
 * near-black ground and to carry text, not about which orange it is.
 */
export const BRAND_HUE = 38;

/** The reference orange verbatim, before any retuning. */
export const REFERENCE_ORANGE = `oklch(0.678 0.208 ${BRAND_HUE})`;

export type Tokens = Record<string, string>;

export type Candidate = {
  key: string;
  /** Shown in the switcher bar. */
  name: string;
  /** One line on where this candidate stands on the three axes. */
  thesis: string;
  axes: { edge: string; accent: string; ground: string };
  tokens: Tokens;
  /**
   * How a card gets its edge. Applied on top of `Card`'s shipped
   * `ring-1 ring-foreground/10` so the difference is visible without editing
   * the real component.
   */
  cardEdgeClass: string;
  /** Whether orange leaks past the CTA into numbers, nav, and table emphasis. */
  accentBreadth: "narrow" | "medium" | "broad";
};

/** Tokens every candidate shares — the parts not under decision here. */
const shared: Tokens = {
  "--foreground": "oklch(0.985 0 0)",
  "--card-foreground": "oklch(0.985 0 0)",
  "--popover-foreground": "oklch(0.985 0 0)",
  "--secondary-foreground": "oklch(0.985 0 0)",
  "--accent-foreground": "oklch(0.985 0 0)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--radius": "0.625rem",
};

export const CANDIDATES: Candidate[] = [
  {
    key: "A",
    name: "Edge",
    thesis:
      "Flat ground: card and page are the SAME lightness, and every surface is defined by a visible 1px edge. Orange is rationed to one CTA and the focus ring.",
    axes: {
      edge: "visible border does all the work (card === page lightness)",
      accent: "narrow — --primary and --ring only (orange @ L 0.72)",
      ground: "shallow — 0.175 ground, ladder climbs to 0.235",
    },
    accentBreadth: "narrow",
    cardEdgeClass: "ring-0 border border-border",
    tokens: {
      ...shared,
      "--background": "oklch(0.175 0 0)",
      "--card": "oklch(0.175 0 0)",
      "--popover": "oklch(0.215 0 0)",
      "--secondary": "oklch(0.235 0 0)",
      "--muted": "oklch(0.235 0 0)",
      "--muted-foreground": "oklch(0.72 0 0)",
      "--accent": "oklch(0.235 0 0)",
      "--border": "oklch(1 0 0 / 16%)",
      // 34%, not shadcn's 15%: this draws the boundary of `Input`,
      // `SelectTrigger` and the `outline` Button, so WCAG 1.4.11 wants 3:1.
      "--input": "oklch(1 0 0 / 34%)",
      // Lifted off the reference's 0.678 L for headroom, since a shallow
      // ground gives the accent less to push against.
      "--primary": `oklch(0.72 0.195 ${BRAND_HUE})`,
      "--primary-foreground": "oklch(0.175 0 0)",
      "--ring": `oklch(0.72 0.195 ${BRAND_HUE})`,
    },
  },
  {
    key: "B",
    name: "Depth",
    thesis:
      "Lightness alone: a deep ground with cards genuinely lifted off it, edges nearly absent. Orange reaches the CTA, the ring, and the one number each card is about.",
    axes: {
      edge: "none to speak of — 8% border; the ladder carries it",
      accent: "medium — + the headline number on each card (reference orange)",
      ground: "deep — 0.115 ground, ladder climbs to 0.265",
    },
    accentBreadth: "medium",
    cardEdgeClass: "ring-0",
    tokens: {
      ...shared,
      "--background": "oklch(0.115 0 0)",
      "--card": "oklch(0.185 0 0)",
      "--popover": "oklch(0.225 0 0)",
      "--secondary": "oklch(0.265 0 0)",
      "--muted": "oklch(0.265 0 0)",
      "--muted-foreground": "oklch(0.708 0 0)",
      "--accent": "oklch(0.265 0 0)",
      "--border": "oklch(1 0 0 / 8%)",
      // The deepest ground needs the most: 36% to clear 3:1 on the card.
      "--input": "oklch(1 0 0 / 36%)",
      // The reference orange verbatim. An earlier draft lifted this to
      // L 0.755 for orange-as-a-number headroom; that pushed chroma past the
      // sRGB ceiling (0.153 at that lightness), so the browser clamped it and
      // the accent read visibly weaker than C's for no benefit — the
      // reference orange already scores 5.86:1 as a number on this card.
      // `?accent=bright` still shows that draft, unclamped.
      "--primary": REFERENCE_ORANGE,
      "--primary-foreground": "oklch(0.16 0 0)",
      "--ring": REFERENCE_ORANGE,
    },
  },
  {
    key: "C",
    name: "Both",
    thesis:
      "Deep ground AND a visible edge, with orange used as a wayfinding colour: CTA, ring, active nav, headline numbers, and the emphasised table column.",
    axes: {
      edge: "lightness + a 15% border on every surface",
      accent:
        "broad — + active nav, table emphasis, card rule (reference orange, L 0.678)",
      ground: "deep — 0.13 ground, ladder climbs to 0.26",
    },
    accentBreadth: "broad",
    cardEdgeClass: "ring-0 border border-border",
    tokens: {
      ...shared,
      "--background": "oklch(0.13 0 0)",
      "--card": "oklch(0.19 0 0)",
      "--popover": "oklch(0.235 0 0)",
      "--secondary": "oklch(0.26 0 0)",
      "--muted": "oklch(0.26 0 0)",
      "--muted-foreground": "oklch(0.715 0 0)",
      "--accent": "oklch(0.26 0 0)",
      "--border": "oklch(1 0 0 / 15%)",
      "--input": "oklch(1 0 0 / 35%)",
      // The reference orange verbatim — the most saturated, most red-leaning
      // of the three, and the one closest to the RentEngine screenshot.
      "--primary": REFERENCE_ORANGE,
      "--primary-foreground": "oklch(0.14 0 0)",
      "--ring": REFERENCE_ORANGE,
    },
  },
];

export const DEFAULT_VARIANT = "A";

export function candidateFor(key: string | undefined): Candidate {
  return (
    CANDIDATES.find((c) => c.key === (key ?? DEFAULT_VARIANT)) ?? CANDIDATES[0]!
  );
}

/**
 * Accent overrides, switchable independently of the candidate (`?accent=`).
 *
 * Added after the first review round: B's orange read as visibly weaker than
 * C's, and the cause was a gamut ceiling, not a design choice. In the orange
 * region the largest chroma sRGB can display falls off fast with lightness —
 * at hue ~40 it is 0.214 at L 0.678 but only 0.153 at L 0.755. B was lifted
 * to L 0.755 to give orange-as-a-number headroom over 4.5:1, and paid ~26% of
 * its chroma for it. The headroom turned out to be unnecessary: the reference
 * orange scores 5.86:1 as a number on B's card, well clear of AA.
 *
 * Every chroma here sits ON or under its ceiling, so nothing gets silently
 * clamped by the browser into a colour the token doesn't name.
 */
export type Accent = {
  key: string;
  name: string;
  note: string;
  primary: string;
  /** Foreground that keeps the button label over 4.5:1. */
  primaryForeground: string;
};

export const ACCENTS: Accent[] = [
  {
    key: "reference",
    name: "Reference",
    note: "The RentEngine orange verbatim — the most intense the family gets in sRGB (ceiling 0.214 at this lightness).",
    primary: "oklch(0.678 0.208 38)",
    primaryForeground: "oklch(0.14 0 0)",
  },
  {
    key: "lifted",
    name: "Lifted",
    note: "A touch brighter for a deep ground, sitting exactly on the gamut ceiling (0.195 at L 0.70). Nothing is clamped.",
    primary: "oklch(0.70 0.195 38)",
    primaryForeground: "oklch(0.15 0 0)",
  },
  {
    key: "bright",
    name: "Bright",
    note: "What B actually rendered before — L 0.755 forces chroma down to 0.153. The honest, unclamped value of the old token.",
    primary: "oklch(0.755 0.15 42)",
    primaryForeground: "oklch(0.16 0 0)",
  },
];

export function accentFor(key: string | undefined): Accent | null {
  if (!key) return null;
  return ACCENTS.find((a) => a.key === key) ?? null;
}

/** Apply an accent override on top of a candidate's tokens. */
export function withAccent(
  candidate: Candidate,
  accent: Accent | null,
): Candidate {
  if (!accent) return candidate;
  return {
    ...candidate,
    tokens: {
      ...candidate.tokens,
      "--primary": accent.primary,
      "--primary-foreground": accent.primaryForeground,
      "--ring": accent.primary,
    },
  };
}
