/**
 * The search box of the row popover's card and H.I.F. ability steps (docs/plans/
 * EXECPLAN_MEMORY_MEMO.md, D19). A name matches when it contains the query once both are folded:
 * full-width letters and digits to half-width and katakana to hiragana, so ふぁんさ finds ファンサ
 * and ＋ finds +. The order is the caller's (the game's order until Milestone 6 ranks by counts).
 */

const KATAKANA_FIRST = 0x30a1;
const KATAKANA_LAST = 0x30f6;
const TO_HIRAGANA = 0x60;

/** The text as the search compares it. */
export function fold(text: string): string {
  let folded = "";
  for (const char of text.normalize("NFKC").toLowerCase()) {
    const code = char.codePointAt(0) ?? 0;
    folded += code >= KATAKANA_FIRST && code <= KATAKANA_LAST ? String.fromCodePoint(code - TO_HIRAGANA) : char;
  }
  return folded;
}

/** The entries whose name contains the query, folded, in their order; a blank query keeps them all. */
export function search<T>(entries: readonly T[], query: string, nameOf: (entry: T) => string): T[] {
  const wanted = fold(query.trim());
  return entries.filter((entry) => fold(nameOf(entry)).includes(wanted));
}
