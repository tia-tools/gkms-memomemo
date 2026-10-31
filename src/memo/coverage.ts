/**
 * What a row owns and misses (docs/plans/EXECPLAN_MEMORY_MEMO.md, D9, D13): the 早見表's line per
 * row, and the toggle 「未所持がある行だけ表示」. Read from the memories alone, so a row whose ids are
 * not in the data file is covered like any other (D31).
 */

import { type ExtraPattern, FIXED_PATTERNS, type FixedPattern, type Row } from "./types.ts";

export interface RowCoverage {
  /** How many memories each fixed pattern holds: 0 is 未所持, 1 a ✓, more a ×N. */
  fixed: Record<FixedPattern, number>;
  /** The fixed patterns with no memory, in display order. */
  missing: FixedPattern[];
  /** The patterns of the row's extra groups that hold a memory, in the row's order (the 早見表's grey tags); an emptied group owns nothing (D27). */
  extras: ExtraPattern[];
}

export function rowCoverage(row: Row): RowCoverage {
  const fixed = { "%%F": row.fixed["%%F"].length, "%F%": row.fixed["%F%"].length, "F%%": row.fixed["F%%"].length };
  return { fixed, missing: FIXED_PATTERNS.filter((p) => fixed[p] === 0), extras: row.extras.filter((g) => g.memories.length > 0).map((g) => g.pattern) };
}

/** True when a fixed pattern has no memory: the rows 「未所持がある行だけ表示」 keeps. */
export function hasGaps(row: Row): boolean {
  return rowCoverage(row).missing.length > 0;
}
