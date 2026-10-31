/**
 * Lookups into the skill card file for the page (docs/plans/EXECPLAN_MEMORY_MEMO.md, D8, D19, D31):
 * a card at its level, an H.I.F. ability with its card, what a tab offers in its pickers, and the
 * short labels of a chosen customization. Anything the file lacks is `undefined`, never a throw, so
 * a saved row the data no longer knows is drawn as unknown (D31).
 */

import type { CustomizationKind, HifAbility, SkillCard, SkillCardDataFile } from "../data/contract.ts";
import type { ChosenStep, PlanId } from "../memo/types.ts";

/** An H.I.F. ability with the card it belongs to, at its base level (its name and art). */
export interface HifEntry {
  ability: HifAbility;
  card: SkillCard;
}

export interface Catalog {
  data: SkillCardDataFile;
  /** The card at that level, or undefined when the file does not have it. */
  card: (id: string, upgrade: number) => SkillCard | undefined;
  /** The ability and its card, or undefined when the file does not have both. */
  hif: (id: string) => HifEntry | undefined;
  /** The cards a tab offers (D8): the plan's cards, then the free ones, each in the game's order, base before +. */
  tabCards: (plan: PlanId) => SkillCard[];
  /** The H.I.F. abilities a tab offers: those of the plan's cards, in their cards' game order. */
  tabAbilities: (plan: PlanId) => HifEntry[];
}

const cardKey = (id: string, upgrade: number) => `${id}:${upgrade}`;

export function makeCatalog(data: SkillCardDataFile): Catalog {
  const cards = new Map(data.cards.map((c) => [cardKey(c.id, c.upgrade), c]));
  const place = new Map(data.cards.map((c, i) => [c.id, i]));
  const hifs = new Map<string, HifEntry>();
  for (const ability of data.hifAbilities) {
    const card = cards.get(cardKey(ability.card, 0));
    if (card !== undefined) hifs.set(ability.id, { ability, card });
  }
  const byCardOrder = (a: HifEntry, b: HifEntry) => (place.get(a.card.id) ?? 0) - (place.get(b.card.id) ?? 0);
  return {
    data,
    card: (id, upgrade) => cards.get(cardKey(id, upgrade)),
    hif: (id) => hifs.get(id),
    tabCards: (plan) => [...data.cards.filter((c) => c.plan === plan), ...data.cards.filter((c) => c.plan === "free")],
    tabAbilities: (plan) => [...hifs.values()].filter((h) => h.card.plan === plan).toSorted(byCardOrder),
  };
}

/**
 * How one step of a kind is written (D7's 好調+1, D48): the step's label from the file, with the
 * game's line break taken out, and the step's number after it when the label is a generic one
 * ending in + or - (好調+1, パラメータ+2, コスト値-1), since the steps of a kind share that label. A step
 * with its own description (好調追加, 成長追加) is written as it is.
 */
export function stepText(kind: CustomizationKind, step: number): string {
  const label = (kind.steps.find((s) => s.step === step)?.label ?? "").replaceAll("\n", "");
  return label.endsWith("+") || label.endsWith("-") ? `${label}${step}` : label;
}

/** A row's customization as short labels in the card's kind order; a kind or step the card lacks reads 不明. */
export function customizationTexts(card: SkillCard | undefined, chosen: readonly ChosenStep[]): string[] {
  const kinds = card?.customization.kinds ?? [];
  const known = kinds.flatMap((kind) => chosen.filter((c) => c.kind === kind.id && kind.steps.some((s) => s.step === c.step)).map((c) => stepText(kind, c.step)));
  const unknown = chosen.length - known.length;
  return unknown > 0 ? [...known, ...Array<string>(unknown).fill("不明")] : known;
}
