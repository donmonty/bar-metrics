/**
 * Prints the contrast ratio for every asserted pair in `app/globals.css`.
 *
 * The vitest suite answers pass/fail; this answers "by how much", which is
 * what you want while trying candidate colors. Run: `npx tsx scripts/check-contrast.ts`
 */

import { tokenContrast } from "../lib/theme/contrast";
import { CONTRAST_PAIRS, KNOWN_FAILURES } from "../lib/theme/contrast-pairs";
import { activeTokens, token } from "../lib/theme/tokens";

const tokens = activeTokens();
let failures = 0;

for (const pair of CONTRAST_PAIRS) {
  const fg = token(tokens, pair.foreground);
  const bg = token(tokens, pair.background);
  const ratio = tokenContrast(fg, bg);
  const passes = ratio >= pair.minimum;
  if (!passes) failures += 1;

  const known = KNOWN_FAILURES[pair.label]
    ? ` (known: ${KNOWN_FAILURES[pair.label]})`
    : "";
  console.log(
    `${passes ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  ` +
      `(needs ${pair.minimum}:1)  ${pair.label}${known}\n` +
      `        ${pair.foreground} ${fg}  on  ${pair.background} ${bg}`,
  );
}

console.log(
  `\n${CONTRAST_PAIRS.length - failures}/${CONTRAST_PAIRS.length} pairs pass.`,
);
