/**
 * A card name on one line in the card column (#68): drawn at the row's usual size when it fits,
 * smaller when it does not, never wrapped. The page has no layout to measure in its tests, and a
 * row should not measure itself after it is drawn, so the width is estimated from the characters,
 * as an upper bound: one em for every character, except the narrow ones IBM Plex Sans JP draws at
 * most NARROW_EM wide (measured in Chrome at weight 500, 2026-11-08: digits and + 0.63, the
 * listed punctuation at most 0.51, half-width katakana 0.5). A Latin letter or % counts one em:
 * W is 0.97 and % 0.99, so any smaller figure could clip them.
 */

export const NARROW_EM = 0.64;

const NARROW = new Set("0123456789+-.,:;!?()/' ");
const HALF_KANA_FIRST = 0xff61;
const HALF_KANA_LAST = 0xff9f;

function isNarrow(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return NARROW.has(char) || (code >= HALF_KANA_FIRST && code <= HALF_KANA_LAST);
}

/** How many ems wide the name is drawn, at most; `.card-name` in src/index.css divides the column by it. */
export function nameEms(name: string): number {
  let ems = 0;
  for (const char of name) ems += isNarrow(char) ? NARROW_EM : 1;
  return ems;
}
