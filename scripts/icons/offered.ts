/**
 * Prints, as JSON, the playable idols and every card the page offers, for the Python icon pipeline
 * (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I8): which cards there are and which the page offers
 * comes from the page's own reader and rule, never from a second copy in Python.
 *
 *     bun scripts/icons/offered.ts [library address or directory] > scripts/icons/out/offered.json
 *
 * The pool is read from gkms-library's address by default (library.ts); pass a directory laid out
 * like it, such as gkms-library's `out/site/`, to read a local copy.
 */

import { offered } from "../../src/app/catalog.ts";
import type { Pool } from "../../src/data/pool.ts";
import { readLibrary } from "./library.ts";

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
export function offeredCards(data: Pool): Offered {
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
  const data = await readLibrary(Bun.argv[2]);
  process.stdout.write(`${JSON.stringify(offeredCards(data), null, 1)}\n`);
}
