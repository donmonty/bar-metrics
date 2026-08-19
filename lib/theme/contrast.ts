/**
 * WCAG contrast math for the oklch tokens in `app/globals.css`.
 *
 * The pipeline mirrors what a browser actually does: oklch -> OKLab -> linear
 * sRGB -> 8-bit sRGB (clamped, which is where out-of-gamut colors land), then
 * WCAG's own linearization of those displayed channels. Going through 8-bit
 * means a ratio here matches what devtools reports for the same token.
 */

export type Rgb = { r: number; g: number; b: number };

/** An oklch color; `alpha` is 1 for the opaque `oklch(L C H)` form. */
export type Oklch = { l: number; c: number; h: number; alpha: number };

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.-]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

/** `oklch(0.145 0 0)` / `oklch(1 0 0 / 10%)` -> components. Throws otherwise. */
export function parseOklch(value: string): Oklch {
  const match = OKLCH_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Not an oklch() color: ${value}`);
  }
  const [, l = "", c = "", h = "", alpha] = match;
  return {
    // L and alpha accept the percentage form; C and H never carry one here.
    l: l.endsWith("%") ? Number.parseFloat(l) / 100 : Number.parseFloat(l),
    c: Number.parseFloat(c),
    h: Number.parseFloat(h),
    alpha:
      alpha === undefined
        ? 1
        : alpha.endsWith("%")
          ? Number.parseFloat(alpha) / 100
          : Number.parseFloat(alpha),
  };
}

/** sRGB transfer function (linear -> encoded), per IEC 61966-2-1. */
function encodeSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** Inverse transfer function, in the piecewise form WCAG 2.x specifies. */
function decodeSrgb(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * oklch -> 8-bit sRGB, using Ottosson's OKLab matrices. Out-of-gamut results
 * are clamped per channel, which is what a display does with them anyway.
 */
export function oklchToRgb({ l: L, c: C, h: H }: Oklch): Rgb {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const lCube = L + 0.3963377774 * a + 0.2158037573 * b;
  const mCube = L - 0.1055613458 * a - 0.0638541728 * b;
  const sCube = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lCube ** 3;
  const m3 = mCube ** 3;
  const s3 = sCube ** 3;

  const to8Bit = (channel: number) =>
    Math.round(Math.min(1, Math.max(0, encodeSrgb(channel))) * 255);

  return {
    r: to8Bit(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    g: to8Bit(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    b: to8Bit(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  };
}

/** Alpha-composite `top` over the opaque `bottom`, in 8-bit sRGB. */
export function compositeOver(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  const blend = (t: number, b: number) =>
    Math.round(t * alpha + b * (1 - alpha));
  return {
    r: blend(top.r, bottom.r),
    g: blend(top.g, bottom.g),
    b: blend(top.b, bottom.b),
  };
}

/** WCAG 2.x relative luminance of a displayed 8-bit sRGB color. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * decodeSrgb(r / 255) +
    0.7152 * decodeSrgb(g / 255) +
    0.0722 * decodeSrgb(b / 255)
  );
}

/** WCAG 2.x contrast ratio, 1..21, order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * A background that is not a token but a translucent WASH of one over another
 * — what a Tailwind `bg-primary/20` utility renders as. Issue #68's user chat
 * bubble is the first of these: the accent at a fraction of its weight over
 * the surface behind it, rather than a token of its own.
 */
export type Wash = { alpha: number; over: string };

/**
 * Contrast between two oklch token values. A translucent foreground (the
 * `oklch(... / 10%)` border tokens) is composited over the background first,
 * since that is the color a reader actually sees.
 *
 * `wash` does the same on the other side: the background is then `background`
 * at `wash.alpha` over the opaque `wash.over`, which is the only way to score
 * text sitting on a `bg-<token>/<alpha>` surface.
 */
export function tokenContrast(
  foreground: string,
  background: string,
  wash?: Wash,
): number {
  const fg = parseOklch(foreground);
  const bg = parseOklch(background);

  let bgRgb: Rgb;
  if (wash) {
    const base = parseOklch(wash.over);
    if (base.alpha !== 1) {
      throw new Error(`Wash base must be opaque, got: ${wash.over}`);
    }
    // A wash of an already-translucent token would need both alphas
    // multiplied out; nothing renders that, so it is rejected rather than
    // silently scored as if the token were opaque.
    if (bg.alpha !== 1) {
      throw new Error(
        `Washed background token must be opaque, got: ${background}`,
      );
    }
    bgRgb = compositeOver(oklchToRgb(bg), wash.alpha, oklchToRgb(base));
  } else {
    if (bg.alpha !== 1) {
      throw new Error(`Background token must be opaque, got: ${background}`);
    }
    bgRgb = oklchToRgb(bg);
  }

  const fgRgb =
    fg.alpha === 1
      ? oklchToRgb(fg)
      : compositeOver(oklchToRgb(fg), fg.alpha, bgRgb);
  return contrastRatio(fgRgb, bgRgb);
}
