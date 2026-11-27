/**
 * This page's card pool, cut from the library's files (docs/plans/EXECPLAN_LIBRARY_DATA.md, L1 and
 * L2). gkms-library publishes every released skill card at every upgrade level and every memory
 * ability as neutral facts (src/data/formats/); which of them this page offers is its own rule:
 * every card that can be a produce memory (docs/plans/EXECPLAN_MEMORY_MEMO.md, D8, D37, D38), and the
 * H.I.F. abilities of those cards. The picker's own narrower rule (no N card but 表現の基本, D54) is
 * `offered` in src/app/catalog.ts. Pure: the checked files are passed in.
 */

import type { IdolsFile } from "./formats/idols.v1.ts";
import type { SkillCard, SkillCardsFile } from "./formats/skill-cards.v1.ts";

/** センス, ロジック, アノマリー, or a card of no plan. */
export type CardPlan = "sense" | "logic" | "anomaly" | "free";
/** Legend is listed although the pool leaves Legend cards out. */
export type CardRarity = "N" | "R" | "SR" | "SSR" | "Legend";
/** アクティブ or メンタル: a trouble card is never in the pool. */
export type CardType = "active" | "mental";

/** A playable P-idol: the game's character id (`hski`) and full name (花海咲季). */
export interface Idol {
  id: string;
  name: string;
}

/**
 * One step of a customization kind: its `customizeCount` and its Japanese label, the step's own
 * description when the game gives one (好調追加), else the generic label of its grow effect
 * (好調+). A label may contain a line break where the game breaks it (パラメータ⏎上昇回数+).
 */
export interface CustomizationStep {
  step: number;
  label: string;
}

/** One customization kind of a card: a ProduceCardCustomize id and its steps, in step order. */
export interface CustomizationKind {
  id: string;
  steps: readonly CustomizationStep[];
}

/** One skill card of the pool at one upgrade level: a ProduceCard id at upgradeCount 0 (base) or 1 (+). */
export interface PoolCard {
  id: string;
  upgrade: number;
  /** As the game writes it at that level (成就+). */
  name: string;
  plan: CardPlan;
  rarity: CardRarity;
  type: CardType;
  /** The game's sort key: sorting these strings gives the game's order. */
  order: string;
  /** Labels of the game's guide categories that list this card, in the order the categories are listed. */
  guideLabels: readonly string[];
  /**
   * The icon: `asset` is the game's asset id (img_general_skillcard_act-3_029). When `perIdol`,
   * each playable idol has a variant named `<asset>-<idol id>`; otherwise the one image is `<asset>`.
   */
  art: { asset: string; perIdol: boolean };
  /** `limit` is the card's maxCustomizeCount; a card that cannot be customized has `{ limit: 0, kinds: [] }`. */
  customization: { limit: number; kinds: readonly CustomizationKind[] };
}

/** An H.I.F. memory ability (a MemoryAbility id) and the ProduceCard id of the card it belongs to. */
export interface HifAbility {
  id: string;
  card: string;
}

/** What the page, the Worker's count check and the icon scripts work from. */
export interface Pool {
  /** In the game's order. */
  idols: readonly Idol[];
  /** In the game's order (by `order`, then id), base before + for each card. */
  cards: readonly PoolCard[];
  /** By id. */
  hifAbilities: readonly HifAbility[];
}

/** The files gave no pool card: a broken publication, never a page with nothing to pick (D43). */
export class PoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoolError";
  }
}

/** 表現の基本: the one starter card that can be a produce memory, at level 0 only (D38). */
const STARTER_EXCEPTION = { id: "p_card-00-men-0_003", upgrade: 0 };
/** The scenario group of 初星アイドルフェスティバル (H.I.F.) in a memory ability's `groups`. */
export const HIF_GROUP = "produce_group-003";

/** A pool card's own type, or null for a card that cannot be one (L1). */
function poolType(card: SkillCard): CardType | null {
  if (card.upgrade !== 0 && card.upgrade !== 1) return null;
  if (card.origin.tag === "idolUnique" || card.origin.supportCard !== null) return null;
  if (card.origin.tag === "starter" && !(card.id === STARTER_EXCEPTION.id && card.upgrade === STARTER_EXCEPTION.upgrade)) return null;
  if (card.type === "trouble" || card.rarity === "Legend") return null;
  return card.type;
}

/** Whether the library's card row can be a produce memory: in this page's pool (L1). */
export function inPool(card: SkillCard): boolean {
  return poolType(card) !== null;
}

function toPoolCard(card: SkillCard, type: CardType): PoolCard {
  const { id, upgrade, name, plan, rarity, order, guideLabels, art, customization } = card;
  return { id, upgrade, name, plan, rarity, type, order, guideLabels, art, customization };
}

/** The pool of two checked library files, in the files' order; throws `PoolError` when no card is left. */
export function pool(skillCards: SkillCardsFile, idols: IdolsFile): Pool {
  const cards: PoolCard[] = [];
  for (const card of skillCards.cards) {
    const type = poolType(card);
    if (type !== null) cards.push(toPoolCard(card, type));
  }
  if (cards.length === 0) throw new PoolError("the skill card file has no card that can be a produce memory");
  const ids = new Set(cards.map((card) => card.id));
  const hifAbilities: HifAbility[] = [];
  for (const ability of skillCards.memoryAbilities) {
    if (ability.card !== undefined && ability.groups.includes(HIF_GROUP) && ids.has(ability.card)) hifAbilities.push({ id: ability.id, card: ability.card });
  }
  return { idols: idols.idols, cards, hifAbilities };
}
