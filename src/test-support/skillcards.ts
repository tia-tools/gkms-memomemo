/** The committed skill card file (src/data/fixtures/skillcards.v1.json) for tests, and lookups into it by name. */

import type { SkillCard, SkillCardDataFile } from "../data/contract.ts";
import { parseSkillCardData } from "../data/load.ts";

export const SKILL_CARDS: SkillCardDataFile = parseSkillCardData(
  JSON.parse(await Bun.file(new URL("../data/fixtures/skillcards.v1.json", import.meta.url)).text()),
);

/** The card of this name (成就+ names the + level), or a failed test. */
export function cardNamed(name: string): SkillCard {
  const card = SKILL_CARDS.cards.find((c) => c.name === name);
  if (card === undefined) throw new Error(`the fixture has no card named ${name}`);
  return card;
}

/** The id of the card's customization kind whose first step carries this label, or a failed test. */
export function kindLabelled(card: SkillCard, label: string): string {
  const kind = card.customization.kinds.find((k) => k.steps[0]?.label === label);
  if (kind === undefined) throw new Error(`${card.name} has no customization ${label}`);
  return kind.id;
}
