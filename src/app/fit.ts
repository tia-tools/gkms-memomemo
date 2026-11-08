/**
 * A card name on one line in the card column (#68): drawn at the row's usual size when it fits,
 * smaller when it does not, never wrapped. The page has no layout to measure in its tests, and a
 * row should not measure itself after it is drawn, so the width is estimated from the characters:
 * a full-width one (kana, kanji, ＆) takes one em, a half-width one (+, Latin letters and digits,
 * half-width katakana) at most HALF_WIDTH_EM of one in IBM Plex Sans JP.
 */

export const HALF_WIDTH_EM = 0.6;

/** Below U+1100 every script the names use is half-width, as are the half-width forms U+FF61–U+FFDC. */
const FULL_WIDTH_FROM = 0x1100;
const HALF_FORMS_FIRST = 0xff61;
const HALF_FORMS_LAST = 0xffdc;

function isHalfWidth(code: number): boolean {
  return code < FULL_WIDTH_FROM || (code >= HALF_FORMS_FIRST && code <= HALF_FORMS_LAST);
}

/** How many ems wide the name is drawn, at most; `.card-name` in src/index.css divides the column by it. */
export function nameEms(name: string): number {
  let ems = 0;
  for (const char of name) ems += isHalfWidth(char.codePointAt(0) ?? 0) ? HALF_WIDTH_EM : 1;
  return ems;
}
