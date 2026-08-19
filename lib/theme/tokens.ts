/**
 * Reads the theme tokens straight out of `app/globals.css`.
 *
 * The contrast checks assert the palette that actually ships, so the token
 * values live in exactly one place — the stylesheet. Copying them into a
 * fixture would let the two drift, which is how the stale hand-written
 * contrast note in globals.css happened in the first place.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GLOBALS_CSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/globals.css",
);

export type TokenSet = Record<string, string>;

/**
 * Pull the custom properties out of one top-level rule. Nested blocks aren't
 * handled — the theme block is flat.
 */
function extractBlock(css: string, selector: string): TokenSet | null {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);

  const tokens: TokenSet = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

/**
 * The tokens in effect for the theme the app renders in.
 *
 * Since issue #71 that is simply `:root`: the palette is dark-only, so the
 * `.dark` block was folded into `:root` and deleted. `app/layout.tsx` still
 * hard-codes `class="dark"` on `<html>` — the `dark:` variant and
 * `chart.tsx`'s `.dark [data-chart=…]` rules both need it — but no token
 * depends on it any more.
 *
 * A reappearing `.dark` block is therefore a regression, not an extra layer to
 * merge: everything this harness asserts lives in `:root`, so silently reading
 * only `:root` would let a second palette ship unscored. Fail loudly instead.
 */
export function activeTokens(
  css = readFileSync(GLOBALS_CSS, "utf8"),
): TokenSet {
  if (extractBlock(css, ".dark")) {
    throw new Error(
      "app/globals.css has a `.dark` block again — the palette is dark-only " +
        "and lives in `:root` (issue #71). Fold it back in, or teach this " +
        "function which block wins before the contrast checks can be trusted.",
    );
  }

  const root = extractBlock(css, ":root");
  if (!root) {
    throw new Error("No :root block found in app/globals.css");
  }
  return root;
}

/** Look up a token, failing loudly rather than silently skipping a check. */
export function token(tokens: TokenSet, name: string): string {
  const value = tokens[name];
  if (value === undefined) {
    throw new Error(`Token ${name} is not defined in app/globals.css`);
  }
  return value;
}
