/**
 * The sort button (docs/plans/EXECPLAN_MEMORY_MEMO.md, D15, D36, D44, D45, D47): a one-time, stable
 * rearrange of one section, whose result becomes the player's own order. The memo passed in is not
 * changed, so it is the undo. A row whose card is not in the data file (D31) sorts after every
 * known card, keeping its order.
 */

import type { SkillCard, SkillCardRarity } from "../data/contract.ts";
import type { Memo, Row, SectionId } from "./types.ts";

/** レアリティ, アクティブ/メンタル, buff type (the game's guide categories); no 五十音 (D47). */
export const SORT_KEYS = ["rarity", "type", "buff"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** The data file's card at that level, or undefined when the file does not have it. */
export type CardLookup = (card: string, upgrade: number) => SkillCard | undefined;

/** D45: highest rarity first. */
export const RARITY_ORDER: readonly SkillCardRarity[] = ["Legend", "SSR", "SR", "R", "N"];

/**
 * D36, D44: the guide category labels in the order they first appear in the game's
 * `ProduceGuideProduceCardCategory.yaml` (vertesan/gakumasu-diff at fc6afb8b5ba4, 2026-10-28),
 * without その他のスキルカード, which sorts with the cards in no category. The data file carries each
 * card's labels but not this order, so it is copied here; a label missing from the list sorts after
 * the listed ones, and a test fails when the data file has one.
 */
export const GUIDE_LABEL_ORDER: readonly string[] = [
  "やる気を増加するスキルカード",
  "スコアを上昇させるスキルカード",
  "元気を増加するスキルカード",
  "好印象を増加するスキルカード",
  "強気に変更するスキルカード",
  "温存に変更するスキルカード",
  "全力値を増加するスキルカード",
  "集中を増加するスキルカード",
  "好調を増加するスキルカード",
  "絶好調を増加するスキルカード",
];
export const OTHER_LABEL = "その他のスキルカード";

/** A card's place under the buff-type key: its earliest listed label, then unlisted labels, then none or その他 (D36). */
function buffRank(card: SkillCard): number {
  const ranks = card.guideLabels
    .filter((label) => label !== OTHER_LABEL)
    .map((label) => (GUIDE_LABEL_ORDER.includes(label) ? GUIDE_LABEL_ORDER.indexOf(label) : GUIDE_LABEL_ORDER.length));
  return ranks.length === 0 ? GUIDE_LABEL_ORDER.length + 1 : Math.min(...ranks);
}

function compareCards(key: SortKey, a: SkillCard, b: SkillCard): number {
  switch (key) {
    case "rarity":
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    case "type":
      return (a.type === "active" ? 0 : 1) - (b.type === "active" ? 0 : 1);
    case "buff":
      return buffRank(a) - buffRank(b);
  }
}

/** The rows in the key's order; equal rows, and rows of unknown cards (last), keep their order. */
export function sortRows(rows: readonly Row[], key: SortKey, cardOf: CardLookup): Row[] {
  const entries = rows.map((row) => ({ row, card: cardOf(row.build.card, row.build.upgrade) }));
  const sorted = entries.toSorted((a, b) => {
    if (a.card === undefined || b.card === undefined) return (a.card === undefined ? 1 : 0) - (b.card === undefined ? 1 : 0);
    return compareCards(key, a.card, b.card);
  });
  return sorted.map((entry) => entry.row);
}

/** The memo with one section sorted by the key (D15); every other section as it was. */
export function sortSection(memo: Memo, section: SectionId, key: SortKey, cardOf: CardLookup): Memo {
  return { ...memo, sections: { ...memo.sections, [section]: sortRows(memo.sections[section], key, cardOf) } };
}
