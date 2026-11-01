/**
 * The value a cell shows, which follows from its kind and tier and is never typed (D2): a
 * percentage growth bonus is 3.5 for diamond (the game's UR) and 2.8 for rainbow (SSR), a fixed
 * initial bonus 25 and 20 (Surprises & Discoveries, the four rarities' values).
 */

import type { Kind, Memory, Pattern, Tier } from "./types.ts";

export const CELL_VALUES: Record<Kind, Record<Tier, string>> = {
  "%": { diamond: "3.5", rainbow: "2.8" },
  F: { diamond: "25", rainbow: "20" },
};

function kindAt(pattern: Pattern, index: number): Kind {
  return pattern[index] === "%" ? "%" : "F";
}

/** The kinds of a pattern's Vo, Da and Vi cells. */
export function kindsOf(pattern: Pattern): [Kind, Kind, Kind] {
  return [kindAt(pattern, 0), kindAt(pattern, 1), kindAt(pattern, 2)];
}

/** The three values a memory of this pattern shows, Vo, Da, Vi. */
export function cellValues(pattern: Pattern, memory: Memory): [string, string, string] {
  const [vo, da, vi] = kindsOf(pattern);
  return [CELL_VALUES[vo][memory[0]], CELL_VALUES[da][memory[1]], CELL_VALUES[vi][memory[2]]];
}
