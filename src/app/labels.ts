/**
 * The page's Japanese words for the memo's ids (docs/plans/EXECPLAN_MEMORY_MEMO.md § Context and
 * Orientation for the plans and sections, D3 and Artifacts and Notes for the column labels and the
 * stat colours, D26 for Japanese only).
 */

import type { Refusal } from "../memo/edit.ts";
import type { SortKey } from "../memo/sort.ts";
import type { Pattern, PlanId, SectionId, Tier } from "../memo/types.ts";
import { kindsOf } from "../memo/values.ts";

export const PLAN_LABELS: Record<PlanId, string> = { sense: "センス", logic: "ロジック", anomaly: "アノマリー" };

export const SECTION_LABELS: Record<SectionId, string> = {
  "sense.kocho": "好調",
  "sense.shuchu": "集中",
  "sense.common": "共通",
  "logic.yaruki": "やる気",
  "logic.koinsho": "好印象",
  "logic.common": "共通",
  "anomaly.tsuyoki": "強気",
  "anomaly.zenryoku": "全力",
  "anomaly.common": "共通",
};

/** Vo, Da, Vi with the colour of the strip over their cells. */
export const STATS = [
  { name: "Vo", color: "#f0468c" },
  { name: "Da", color: "#2f8ff0" },
  { name: "Vi", color: "#f5b400" },
] as const;

/** A group's column labels: Vo% Da% Vi+ for %%F, a fixed bonus written +. */
export function columnLabels(pattern: Pattern): [string, string, string] {
  const [vo, da, vi] = kindsOf(pattern).map((kind) => (kind === "%" ? "%" : "+"));
  return [`Vo${vo ?? ""}`, `Da${da ?? ""}`, `Vi${vi ?? ""}`];
}

export const TIER_LABELS: Record<Tier, string> = { diamond: "◆ダイヤ", rainbow: "虹" };

export const SORT_LABELS: Record<SortKey, string> = { rarity: "レアリティ", type: "アクティブ/メンタル", buff: "バフの種類" };

/** Why an edit was refused, as the page says it. */
export function refusalText(refusal: Refusal): string {
  switch (refusal.refused) {
    case "duplicate":
      return `同じ組み合わせが「${SECTION_LABELS[refusal.section]}」にあります`;
    case "other-tab":
      return "ほかのタブへは移動できません";
    case "pattern-in-row":
      return "このパターンはもうあります";
    case "extras-full":
      return "追加できるのは2つまでです";
  }
}
