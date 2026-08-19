import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  oklchToRgb,
  parseOklch,
  tokenContrast,
} from "./contrast";
import { CONTRAST_PAIRS, KNOWN_FAILURES, scorePair } from "./contrast-pairs";
import { activeTokens } from "./tokens";

describe("oklch conversion", () => {
  it("maps the achromatic extremes to black and white", () => {
    expect(oklchToRgb(parseOklch("oklch(0 0 0)"))).toEqual({
      r: 0,
      g: 0,
      b: 0,
    });
    expect(oklchToRgb(parseOklch("oklch(1 0 0)"))).toEqual({
      r: 255,
      g: 255,
      b: 255,
    });
  });

  it("reads the alpha form the border tokens use", () => {
    expect(parseOklch("oklch(1 0 0 / 10%)")).toMatchObject({
      l: 1,
      alpha: 0.1,
    });
  });

  it("rejects anything that isn't oklch, rather than scoring it wrong", () => {
    expect(() => parseOklch("#fff")).toThrow(/Not an oklch/);
  });
});

describe("contrast ratio", () => {
  it("spans the WCAG range from identical colors to black on white", () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(black, black)).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    const a = "oklch(0.145 0 0)";
    const b = "oklch(0.985 0 0)";
    expect(tokenContrast(a, b)).toBeCloseTo(tokenContrast(b, a), 10);
  });

  it("composites a translucent foreground over its background", () => {
    // A 10%-white border on near-black is nearly invisible; scoring it as
    // opaque white would claim it passes everything.
    const composited = tokenContrast("oklch(1 0 0 / 10%)", "oklch(0.145 0 0)");
    const opaque = tokenContrast("oklch(1 0 0)", "oklch(0.145 0 0)");
    expect(composited).toBeLessThan(2);
    expect(opaque).toBeGreaterThan(15);
  });

  it("scores a washed background on the composite, not the token", () => {
    // The user chat bubble (#68): `bg-primary/20` over the well. Text on the
    // wash keeps almost all the contrast it had on the well; text on solid
    // orange has nearly none. Scoring the wash as if it were the token would
    // condemn a bubble that is in fact perfectly legible.
    const white = "oklch(0.985 0 0)";
    const wash = tokenContrast(white, "oklch(0.678 0.208 38)", {
      alpha: 0.2,
      over: "oklch(0.185 0.008 240)",
    });
    const solid = tokenContrast(white, "oklch(0.678 0.208 38)");
    expect(wash).toBeGreaterThan(10);
    expect(solid).toBeLessThan(4.5);
  });

  it("rejects a wash whose base is translucent, rather than guessing", () => {
    expect(() =>
      tokenContrast("oklch(0.985 0 0)", "oklch(0.678 0.208 38)", {
        alpha: 0.2,
        over: "oklch(1 0 0 / 8%)",
      }),
    ).toThrow(/Wash base must be opaque/);
  });
});

describe("app/globals.css meets WCAG AA", () => {
  const tokens = activeTokens();

  for (const pair of CONTRAST_PAIRS) {
    const known = KNOWN_FAILURES[pair.label];
    const name = `${pair.label} clears ${pair.minimum}:1`;

    if (known) {
      // Documented as failing, with the ticket that fixes it. Asserted the
      // other way round so that fixing the palette turns this test red and
      // forces the entry out of KNOWN_FAILURES.
      it(`${name} — known failure, ${known}`, () => {
        const ratio = scorePair(tokens, pair);
        expect(
          ratio,
          `${pair.label} now passes — remove it from KNOWN_FAILURES`,
        ).toBeLessThan(pair.minimum);
      });
      continue;
    }

    it(name, () => {
      const ratio = scorePair(tokens, pair);
      const ground = pair.wash
        ? `${pair.background}/${pair.wash.alpha * 100} over ${pair.wash.over}`
        : pair.background;
      expect(
        ratio,
        `${pair.foreground} on ${ground} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(pair.minimum);
    });
  }
});
