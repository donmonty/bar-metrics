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
 * Pull the custom properties out of one top-level rule, e.g. `:root` or
 * `.dark`. Nested blocks aren't handled — the theme blocks are flat.
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
 * `app/layout.tsx` hard-codes `class="dark"` on `<html>`, so `.dark` values
 * win wherever they exist and `:root` supplies the rest. Once the dark values
 * move into `:root` and `.dark` is deleted (issue #60), this keeps working —
 * the `.dark` layer is simply absent.
 */
export function activeTokens(
  css = readFileSync(GLOBALS_CSS, "utf8"),
): TokenSet {
  const root = extractBlock(css, ":root");
  if (!root) {
    throw new Error("No :root block found in app/globals.css");
  }
  return { ...root, ...(extractBlock(css, ".dark") ?? {}) };
}

/** Look up a token, failing loudly rather than silently skipping a check. */
export function token(tokens: TokenSet, name: string): string {
  const value = tokens[name];
  if (value === undefined) {
    throw new Error(`Token ${name} is not defined in app/globals.css`);
  }
  return value;
}
