/**
 * Prints, as JSON, the playable idols and every card the page offers, for the Python icon pipeline
 * (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I8): which cards there are and which the page offers
 * comes from the page's own reader and rule, never from a second copy in Python.
 *
 *     bun scripts/icons/offered.ts [data file] > scripts/icons/out/offered.json
 *
 * The data file defaults to the committed fixture; pass the live file (downloaded from
 * https://gakumas-supportcards.tia.run/data/skillcards.v1.json) to build for cards added since.
 */

import { offered } from "../../src/app/catalog.ts";
import type { SkillCardDataFile } from "../../src/data/contract.ts";
import { parseSkillCardData } from "../../src/data/load.ts";

export interface OfferedCard {
  id: string;
  upgrade: number;
  name: string;
  plan: string;
  rarity: string;
  type: string;
  order: string;
  asset: string;
  perIdol: boolean;
}

export interface Offered {
  idols: string[];
  cards: OfferedCard[];
}

/** The idols in the game's order and the offered cards in the file's order. */
export function offeredCards(data: SkillCardDataFile): Offered {
  return {
    idols: data.idols.map((idol) => idol.id),
    cards: data.cards.filter(offered).map((c) => ({
      id: c.id,
      upgrade: c.upgrade,
      name: c.name,
      plan: c.plan,
      rarity: c.rarity,
      type: c.type,
      order: c.order,
      asset: c.art.asset,
      perIdol: c.art.perIdol,
    })),
  };
}

if (import.meta.main) {
  const path = Bun.argv[2] ?? new URL("../../src/data/fixtures/skillcards.v1.json", import.meta.url).pathname;
  const data = parseSkillCardData(await Bun.file(path).json());
  process.stdout.write(`${JSON.stringify(offeredCards(data), null, 1)}\n`);
}
