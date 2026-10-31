/**
 * The row popover's customization step (docs/plans/EXECPLAN_MEMORY_MEMO.md, D7, D19, D39, D40):
 * what tapping a step, なし or 開幕時獲得 does to the draft build, and which steps can be tapped at all.
 * Every rule is build.ts's; this only says how a tap maps onto it, so the popover can never hold a
 * build the rules refuse.
 */

import { type BuildProblem, type CardRules, isBuildProblem, kaimakuSwitch, withCustomization } from "../memo/build.ts";
import type { Build } from "../memo/types.ts";

/** The step chosen for this kind, or null. */
export function chosenStep(build: Build, kind: string): number | null {
  return build.customization.find((c) => c.kind === kind)?.step ?? null;
}

/**
 * The build with the kind at this step, or without the kind when that step is the chosen one (a
 * second tap takes it back), or why it cannot be. A step beyond the 開幕時獲得 cap switches
 * 開幕時獲得 off (D40).
 */
export function pickStep(build: Build, kind: string, step: number, card: CardRules): Build | BuildProblem {
  const others = build.customization.filter((c) => c.kind !== kind);
  const next = chosenStep(build, kind) === step ? others : [...others, { kind, step }];
  return withCustomization(build, next, card);
}

/** Whether tapping the step gives a build the rules accept: the steps the popover enables (D39). */
export function stepOpen(build: Build, kind: string, step: number, card: CardRules): boolean {
  return !isBuildProblem(pickStep(build, kind, step, card));
}

/** The build with 開幕時獲得 switched, where the switch allows it (D40); otherwise as it was. */
export function switchKaimaku(build: Build, card: CardRules): Build {
  return kaimakuSwitch(build, card) === "switchable" ? { ...build, kaimaku: !build.kaimaku } : build;
}

/** Whether the step has nothing to choose, so the popover goes on past it: no kinds, and 開幕時獲得 fixed. */
export function nothingToCustomize(build: Build, card: CardRules): boolean {
  return card.customization.kinds.length === 0 && kaimakuSwitch(build, card) !== "switchable";
}
