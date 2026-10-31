/**
 * The shape of the skill card data gakumas-supportcards publishes at /data/skillcards.v1.json
 * (docs/adr/0001 here; docs/adr/0010's addendum and data/skillcard-data-file.ts there), served to
 * this page at /data/skillcards.json. The format version and the types below are copied verbatim
 * from that file as of its merge f336717 (2026-10-31), with their comments; the writer's own
 * helpers (the file's path and its JSON text) are left there. A change to any of them there bumps
 * the file's format version and name (skillcards.v2.json); copy the new shapes here then, never
 * edit these on their own.
 */

export const SKILLCARD_DATA_FORMAT_VERSION = 1;

/** センス, ロジック, アノマリー, or a card of no plan (ProducePlanType_Plan1, Plan2, Plan3, Common). */
export type SkillCardPlan = "sense" | "logic" | "anomaly" | "free";
/** Legend is listed although the pool excludes Legend cards today. */
export type SkillCardRarity = "N" | "R" | "SR" | "SSR" | "Legend";
/** アクティブ or メンタル. */
export type SkillCardType = "active" | "mental";

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

/**
 * One skill card at one upgrade level: a ProduceCard id at upgradeCount 0 (base) or 1 (+).
 * The pool is every released card that can be a produce memory (gkms-memomemo decisions D8,
 * D37, D38): P-idol unique, support-card event, starter (except level 0 of 表現の基本), trouble
 * and Legend cards are left out.
 */
export interface SkillCard {
  id: string;
  upgrade: number;
  /** As the game writes it at that level (成就+). */
  name: string;
  plan: SkillCardPlan;
  rarity: SkillCardRarity;
  type: SkillCardType;
  /** The game's sort key: sorting these strings gives the game's order. */
  order: string;
  /** Labels of the game's guide categories that list this card, in the order the categories are listed. */
  guideLabels: readonly string[];
  /**
   * The icon: `asset` is the game's asset id (img_general_skillcard_act-3_029). When `perIdol`,
   * each playable idol has a variant named `<asset>-<idol id>`; otherwise the one image is `<asset>`.
   */
  art: { asset: string; perIdol: boolean };
  /** `limit` is the card's maxCustomizeCount; a base card has `{ limit: 0, kinds: [] }`. */
  customization: { limit: number; kinds: readonly CustomizationKind[] };
}

/** An H.I.F. memory ability (a MemoryAbility id) and the ProduceCard id of the card it belongs to. */
export interface HifAbility {
  id: string;
  card: string;
}

export interface SkillCardDataFile {
  formatVersion: typeof SKILLCARD_DATA_FORMAT_VERSION;
  /** In the game's order (Character.order). */
  idols: readonly Idol[];
  /** In the game's order (by `order`, then id), base before + for each card. */
  cards: readonly SkillCard[];
  /** By id. */
  hifAbilities: readonly HifAbility[];
}
