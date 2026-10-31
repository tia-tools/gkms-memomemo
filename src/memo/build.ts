/**
 * A build's identity and its validity against its card (docs/plans/EXECPLAN_MEMORY_MEMO.md, D1,
 * D7, D33, D39, D40). The game's rules are the two named constants below, so a change of a rule is
 * one edit; the card's own options and limit come from the data file.
 */

import type { SkillCard, SkillCardRarity } from "../data/contract.ts";
import type { Build, ChosenStep } from "./types.ts";

/** D39: a produce memory's customization steps add up to at most this, whatever the card's limit. */
export const MEMORY_STEP_CAP = 2;

/**
 * D40: the cards that can have 開幕時獲得, and how many customization steps they may carry while it
 * is on. A card no entry matches cannot have it (today SSR and N + cards). `alwaysOn`: the player
 * cannot switch it off (a base card's memory is always 開幕時獲得).
 */
export const KAIMAKU_RULES: readonly { upgrade: number; rarity?: SkillCardRarity; cap: number; alwaysOn: boolean }[] = [
  { upgrade: 0, cap: 0, alwaysOn: true },
  { upgrade: 1, rarity: "R", cap: MEMORY_STEP_CAP, alwaysOn: false },
  { upgrade: 1, rarity: "SR", cap: 0, alwaysOn: false },
];

/** What a build's rules read from its card in the data file. */
export type CardRules = Pick<SkillCard, "upgrade" | "rarity" | "customization">;

function byKindThenStep(a: ChosenStep, b: ChosenStep): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.step - b.step;
}

/** The build's identity: equal for equal builds whatever order the customization was chosen in. */
export function buildKey(build: Build): string {
  const steps = build.customization.toSorted(byKindThenStep).map((s) => [s.kind, s.step]);
  return JSON.stringify([build.card, build.upgrade, steps, build.kaimaku, build.hif]);
}

/** The customization's steps, added up (D39 counts steps, not kinds). */
export function stepTotal(customization: readonly ChosenStep[]): number {
  return customization.reduce((sum, s) => sum + s.step, 0);
}

/** The steps the card may carry in a memory: its own limit, capped by D39. */
export function stepLimit(card: CardRules): number {
  return Math.min(card.customization.limit, MEMORY_STEP_CAP);
}

/** The card's 開幕時獲得 rule, or null when it cannot have 開幕時獲得. */
export function kaimakuRule(card: CardRules): { cap: number; alwaysOn: boolean } | null {
  const rule = KAIMAKU_RULES.find((r) => r.upgrade === card.upgrade && (r.rarity === undefined || r.rarity === card.rarity));
  return rule === undefined ? null : { cap: rule.cap, alwaysOn: rule.alwaysOn };
}

export type BuildProblem =
  | { problem: "unknown-kind"; kind: string }
  | { problem: "unknown-step"; kind: string; step: number }
  | { problem: "repeated-kind"; kind: string }
  | { problem: "over-limit"; steps: number; limit: number }
  | { problem: "kaimaku-unavailable" }
  | { problem: "kaimaku-required" }
  | { problem: "kaimaku-over-cap"; steps: number; cap: number };

function customizationProblem(customization: readonly ChosenStep[], card: CardRules): BuildProblem | null {
  const seen = new Set<string>();
  for (const { kind, step } of customization) {
    const options = card.customization.kinds.find((k) => k.id === kind);
    if (options === undefined) return { problem: "unknown-kind", kind };
    if (!options.steps.some((s) => s.step === step)) return { problem: "unknown-step", kind, step };
    if (seen.has(kind)) return { problem: "repeated-kind", kind };
    seen.add(kind);
  }
  const steps = stepTotal(customization);
  const limit = stepLimit(card);
  return steps > limit ? { problem: "over-limit", steps, limit } : null;
}

function kaimakuProblem(build: Build, card: CardRules): BuildProblem | null {
  const rule = kaimakuRule(card);
  if (rule === null) return build.kaimaku ? { problem: "kaimaku-unavailable" } : null;
  if (rule.alwaysOn && !build.kaimaku) return { problem: "kaimaku-required" };
  const steps = stepTotal(build.customization);
  return build.kaimaku && steps > rule.cap ? { problem: "kaimaku-over-cap", steps, cap: rule.cap } : null;
}

/** Why the build cannot exist for this card (its id and level), or null when it can. */
export function buildProblem(build: Build, card: CardRules): BuildProblem | null {
  return customizationProblem(build.customization, card) ?? kaimakuProblem(build, card);
}

/** A new row's build: no customization, 開幕時獲得 on wherever the card can have it (D40). */
export function newBuild(card: string, rules: CardRules, hif: string): Build {
  return { card, upgrade: rules.upgrade, customization: [], kaimaku: kaimakuRule(rules) !== null, hif };
}

export function isBuildProblem(result: Build | BuildProblem): result is BuildProblem {
  return "problem" in result;
}

/**
 * The build with this customization, or why it cannot have it: a returned build is always one
 * `buildProblem` accepts. Steps beyond the card's 開幕時獲得 cap switch 開幕時獲得 off (D40); on a card
 * whose 開幕時獲得 is always on, they are refused instead.
 */
export function withCustomization(build: Build, customization: readonly ChosenStep[], card: CardRules): Build | BuildProblem {
  const rule = kaimakuRule(card);
  const overCap = rule !== null && !rule.alwaysOn && stepTotal(customization) > rule.cap;
  const next = { ...build, customization, kaimaku: overCap ? false : build.kaimaku };
  return buildProblem(next, card) ?? next;
}

/**
 * How the 開幕時獲得 switch behaves for this build: `unavailable` (the card cannot have it), `always`
 * (on, and cannot be switched off), `blocked` (off while the customization exceeds the cap) or
 * `switchable`.
 */
export function kaimakuSwitch(build: Build, card: CardRules): "unavailable" | "always" | "blocked" | "switchable" {
  const rule = kaimakuRule(card);
  if (rule === null) return "unavailable";
  if (rule.alwaysOn) return "always";
  return stepTotal(build.customization) > rule.cap ? "blocked" : "switchable";
}
