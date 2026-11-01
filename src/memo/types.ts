/**
 * The memo's shape (docs/plans/EXECPLAN_MEMORY_MEMO.md § Interfaces and Dependencies, and § Context
 * and Orientation for the terms). Card, customization and H.I.F. ability ids are plain strings, the
 * game's own ids, so the memo needs no data file to exist; a saved id missing from the data file is
 * kept as it is (D31).
 */

/** The three tabs, センス / ロジック / アノマリー, in tab order. */
export const PLAN_IDS = ["sense", "logic", "anomaly"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Each tab's two styles and its 共通, in display order; also the ids count events carry. */
export const SECTION_IDS = [
  "sense.kocho",
  "sense.shuchu",
  "sense.common",
  "logic.yaruki",
  "logic.koinsho",
  "logic.common",
  "anomaly.tsuyoki",
  "anomaly.zenryoku",
  "anomaly.common",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** The tab a section is in. */
export function planOf(section: SectionId): PlanId {
  return section.startsWith("sense.") ? "sense" : section.startsWith("logic.") ? "logic" : "anomaly";
}

/** A tab's sections, in display order. */
export function sectionsOf(plan: PlanId): SectionId[] {
  return SECTION_IDS.filter((section) => planOf(section) === plan);
}

/** A stat ability's kind: a percentage growth bonus or a fixed initial bonus. */
export type Kind = "%" | "F";
/** The kinds of a memory's three abilities, Vo, Da, Vi. */
export type Pattern = `${Kind}${Kind}${Kind}`;
/** Shown in every row, in this order (D3). */
export const FIXED_PATTERNS = ["%%F", "%F%", "F%%"] as const;
export type FixedPattern = (typeof FIXED_PATTERNS)[number];
/** The patterns an extra group may have, in the order the picker offers them (D3). */
export const EXTRA_PATTERNS = ["%%%", "FFF", "%FF", "F%F", "FF%"] as const satisfies readonly ExtraPattern[];
export type ExtraPattern = Exclude<Pattern, FixedPattern>;
/** A row holds at most this many extra groups (D3). */
export const MAX_EXTRAS = 2;

/** A stat ability's quality: the game's UR or SSR (D2). */
export const TIERS = ["diamond", "rainbow"] as const;
export type Tier = (typeof TIERS)[number];
/** One memory's three tiers, Vo, Da, Vi. */
export type Memory = readonly [Tier, Tier, Tier];

/** One customization kind chosen at one step: a ProduceCardCustomize id and its customizeCount. */
export interface ChosenStep {
  kind: string;
  step: number;
}

export interface Build {
  /** ProduceCard id. */
  card: string;
  /** Its upgradeCount: 0 base, 1 + (D33, D37). */
  upgrade: number;
  /** Empty for なし; at most one step per kind, the steps adding up to at most 2 (D39). */
  customization: readonly ChosenStep[];
  /** 開幕時獲得 (D40). */
  kaimaku: boolean;
  /** MemoryAbility id of the H.I.F. ability. */
  hif: string;
}

export interface ExtraGroup {
  pattern: ExtraPattern;
  /** May be empty: a group whose last memory is deleted stays, as 未所持, until removed by hand (D27). */
  memories: readonly Memory[];
}

export interface Row {
  /** Random, stable across edits. */
  id: string;
  build: Build;
  fixed: Record<FixedPattern, readonly Memory[]>;
  /** At most MAX_EXTRAS, with distinct patterns. */
  extras: readonly ExtraGroup[];
}

export interface Memo {
  formatVersion: 1;
  scenario: "hif";
  /** Each section in the player's order. */
  sections: Record<SectionId, readonly Row[]>;
}

export function emptyMemo(): Memo {
  return {
    formatVersion: 1,
    scenario: "hif",
    sections: {
      "sense.kocho": [],
      "sense.shuchu": [],
      "sense.common": [],
      "logic.yaruki": [],
      "logic.koinsho": [],
      "logic.common": [],
      "anomaly.tsuyoki": [],
      "anomaly.zenryoku": [],
      "anomaly.common": [],
    },
  };
}

/** A row with no memories: every fixed group shows 未所持 (D13). */
export function emptyRow(id: string, build: Build): Row {
  return { id, build, fixed: { "%%F": [], "%F%": [], "F%%": [] }, extras: [] };
}
