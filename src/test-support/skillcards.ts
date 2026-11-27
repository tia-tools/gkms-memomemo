/**
 * The pool of the committed library releases (src/data/fixtures/, docs/plans/EXECPLAN_LIBRARY_DATA.md,
 * L4) for tests, and lookups into it by name.
 */

import { parse as parseIdols } from "../data/formats/idols.v1.ts";
import { parse as parseSkillCards } from "../data/formats/skill-cards.v1.ts";
import { type Pool, type PoolCard, pool } from "../data/pool.ts";

const fixture = async (name: string): Promise<unknown> => JSON.parse(await Bun.file(new URL(`../data/fixtures/${name}`, import.meta.url)).text());

export const SKILL_CARDS: Pool = pool(
  parseSkillCards(await fixture("skill-cards.v1.20261127T1126Z-a09c6f2a.json")),
  parseIdols(await fixture("idols.v1.20261116T1124Z-5122c626.json")),
);

/** The card of this name (成就+ names the + level), or a failed test. */
export function cardNamed(name: string): PoolCard {
  const card = SKILL_CARDS.cards.find((c) => c.name === name);
  if (card === undefined) throw new Error(`the fixture has no card named ${name}`);
  return card;
}

/** The id of the card's customization kind whose first step carries this label, or a failed test. */
export function kindLabelled(card: PoolCard, label: string): string {
  const kind = card.customization.kinds.find((k) => k.steps[0]?.label === label);
  if (kind === undefined) throw new Error(`${card.name} has no customization ${label}`);
  return kind.id;
}
