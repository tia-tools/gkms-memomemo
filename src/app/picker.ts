/**
 * The row popover's pickers (docs/plans/EXECPLAN_MEMORY_MEMO.md, D19, D56). Search: a name matches
 * when it contains the query once both are folded, full-width letters and digits to half-width and
 * katakana to hiragana, so ふぁんさ finds ファンサ and ＋ finds +. The card step's rarity filter: a
 * toggle per rarity, the cards of the rarities on, every card while none is on. Its level switch
 * (D66): base or enhanced, one at a time. The order is the caller's (ranked by counts, D65).
 */

import type { SkillCardRarity } from "../data/contract.ts";

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

/** The rarity filter's toggles, highest first: the rarities the pool holds (D38: no Legend). */
export const FILTER_RARITIES = ["SSR", "SR", "R", "N"] as const satisfies readonly SkillCardRarity[];

/** The cards of the rarities that are on; every card when none is on. */
export function byRarity<T extends { rarity: SkillCardRarity }>(cards: readonly T[], on: ReadonlySet<SkillCardRarity>): T[] {
  return on.size === 0 ? [...cards] : cards.filter((card) => on.has(card.rarity));
}

/** The level switch's choices, in the game's order: base (upgradeCount 0), then enhanced (1, D37). */
export const LEVELS = [
  { upgrade: 0, label: "基本" },
  { upgrade: 1, label: "強化" },
] as const;

/** The level the switch starts at: the chosen card's, else enhanced (D66). */
export function startLevel(chosen: { upgrade: number } | undefined): number {
  return chosen?.upgrade ?? 1;
}

/** The cards at that level, in their order. */
export function atLevel<T extends { upgrade: number }>(cards: readonly T[], upgrade: number): T[] {
  return cards.filter((card) => card.upgrade === upgrade);
}

/** The set with the value switched: added when it was off, removed when it was on. */
export function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}
