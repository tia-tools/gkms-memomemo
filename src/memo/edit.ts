/**
 * Every change a player makes to the memo, as pure functions from a memo to a new memo
 * (docs/plans/EXECPLAN_MEMORY_MEMO.md § Plan of Work, Milestone 3). A change the rules refuse
 * returns a `Refusal` saying why, for the page to show; a row or memory that is not in the memo, a
 * new row id already used or not of a row id's shape, and a build whose ids lack the game's shape
 * are the caller's mistakes and throw `MemoEditError`, so every memo these functions make is one
 * read.ts accepts (D46). The memo passed in is never changed, so the previous memo is the undo.
 */

import { buildKey } from "./build.ts";
import { buildShapeError, ID_SHAPES } from "./read.ts";
import {
  type Build,
  emptyRow,
  type ExtraPattern,
  FIXED_PATTERNS,
  type FixedPattern,
  MAX_EXTRAS,
  type Memo,
  type Memory,
  planOf,
  type PlanId,
  type Row,
  SECTION_IDS,
  type SectionId,
  sectionsOf,
} from "./types.ts";

export type Refusal =
  /** The build is already in the tab, in this section and row, which the page offers to jump to (D13). */
  | { refused: "duplicate"; section: SectionId; row: string }
  /** A row moves only between the sections of its own tab. */
  | { refused: "other-tab" }
  /** The row already has a group of this pattern (D3). */
  | { refused: "pattern-in-row" }
  /** The row already has MAX_EXTRAS extra groups (D3). */
  | { refused: "extras-full" };

export type Edited = Memo | Refusal;

export function isRefusal(result: Edited): result is Refusal {
  return "refused" in result;
}

/** The edit names a row or a memory the memo does not have. */
export class MemoEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoEditError";
  }
}

/** A group of a row: one of the three fixed patterns or one of its extra groups. */
export type GroupPattern = FixedPattern | ExtraPattern;

function isFixed(pattern: GroupPattern): pattern is FixedPattern {
  return FIXED_PATTERNS.some((p) => p === pattern);
}

/** Where a row is: its section and its index there, or null. */
export function findRow(memo: Memo, rowId: string): { section: SectionId; index: number; row: Row } | null {
  for (const [section, rows] of sectionEntries(memo)) {
    const index = rows.findIndex((r) => r.id === rowId);
    const row = rows[index];
    if (row !== undefined) return { section, index, row };
  }
  return null;
}

function sectionEntries(memo: Memo): [SectionId, readonly Row[]][] {
  return SECTION_IDS.map((s) => [s, memo.sections[s]]);
}

function locate(memo: Memo, rowId: string): { section: SectionId; index: number; row: Row } {
  const place = findRow(memo, rowId);
  if (place === null) throw new MemoEditError(`no row ${rowId}`);
  return place;
}

function withSection(memo: Memo, section: SectionId, rows: readonly Row[]): Memo {
  return { ...memo, sections: { ...memo.sections, [section]: rows } };
}

function replaceRow(memo: Memo, rowId: string, change: (row: Row) => Row): Memo {
  const { section, index, row } = locate(memo, rowId);
  return withSection(memo, section, memo.sections[section].with(index, change(row)));
}

function checkBuild(build: Build): void {
  const problem = buildShapeError(build);
  if (problem !== null) throw new MemoEditError(problem);
}

function checkNewId(memo: Memo, id: string): void {
  if (!ID_SHAPES.row.test(id)) throw new MemoEditError(`row id ${JSON.stringify(id)} is not of a row id's shape`);
  if (findRow(memo, id) !== null) throw new MemoEditError(`row id ${id} is already used`);
}

/** The row of the tab that holds this build and its section, ignoring the row `except`, or null (D13). */
export function rowHolding(memo: Memo, plan: PlanId, build: Build, except?: string): { section: SectionId; row: string } | null {
  const key = buildKey(build);
  for (const section of sectionsOf(plan)) {
    const row = memo.sections[section].find((r) => r.id !== except && buildKey(r.build) === key);
    if (row !== undefined) return { section, row: row.id };
  }
  return null;
}

/** A new row with no memories at the end of the section (D13, D14), unless its build is already in the tab. */
export function addRow(memo: Memo, section: SectionId, id: string, build: Build): Edited {
  checkNewId(memo, id);
  checkBuild(build);
  const holder = rowHolding(memo, planOf(section), build);
  if (holder !== null) return { refused: "duplicate", ...holder };
  return withSection(memo, section, [...memo.sections[section], emptyRow(id, build)]);
}

/** The row with another build, keeping its memories and place, unless that build is elsewhere in the tab (D19). */
export function changeBuild(memo: Memo, rowId: string, build: Build): Edited {
  const { section } = locate(memo, rowId);
  checkBuild(build);
  const holder = rowHolding(memo, planOf(section), build, rowId);
  if (holder !== null) return { refused: "duplicate", ...holder };
  return replaceRow(memo, rowId, (row) => ({ ...row, build }));
}

/** The row moved to the end of another section of its tab (D19). */
export function moveRow(memo: Memo, rowId: string, to: SectionId): Edited {
  const { section, row } = locate(memo, rowId);
  if (planOf(to) !== planOf(section)) return { refused: "other-tab" };
  const without = withSection(memo, section, memo.sections[section].filter((r) => r.id !== rowId));
  return withSection(without, to, [...without.sections[to], row]);
}

/** The row dragged to another place in its section; an index past either end means that end (D14). */
export function reorderRow(memo: Memo, rowId: string, toIndex: number): Memo {
  const { section, index, row } = locate(memo, rowId);
  const rest = memo.sections[section].toSpliced(index, 1);
  const at = Math.min(Math.max(toIndex, 0), rest.length);
  return withSection(memo, section, rest.toSpliced(at, 0, row));
}

/** The memo without the row and its memories (D19). */
export function deleteRow(memo: Memo, rowId: string): Memo {
  const { section } = locate(memo, rowId);
  return withSection(memo, section, memo.sections[section].filter((r) => r.id !== rowId));
}

/** The row with one group's memories changed; a group left with none stays, as 未所持 (D27). */
function changeGroup(row: Row, pattern: GroupPattern, change: (memories: readonly Memory[]) => readonly Memory[]): Row {
  if (isFixed(pattern)) return { ...row, fixed: { ...row.fixed, [pattern]: change(row.fixed[pattern]) } };
  const group = row.extras.find((g) => g.pattern === pattern);
  if (group === undefined) throw new MemoEditError(`row ${row.id} has no ${pattern} group`);
  const memories = change(group.memories);
  return { ...row, extras: row.extras.map((g) => (g === group ? { pattern, memories } : g)) };
}

function checkIndex(memories: readonly Memory[], index: number, where: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= memories.length) throw new MemoEditError(`no memory ${index} in ${where}`);
}

/** Another memory under the group's last one (D4): a fixed group, or an extra group the row has. */
export function addMemory(memo: Memo, rowId: string, pattern: GroupPattern, memory: Memory): Memo {
  return replaceRow(memo, rowId, (row) => changeGroup(row, pattern, (memories) => [...memories, memory]));
}

/** A new extra group holding its first memory (D3, D18), unless the row has the pattern or is full. */
export function addExtraGroup(memo: Memo, rowId: string, pattern: ExtraPattern, memory: Memory): Edited {
  const { row } = locate(memo, rowId);
  if (row.extras.some((g) => g.pattern === pattern)) return { refused: "pattern-in-row" };
  if (row.extras.length >= MAX_EXTRAS) return { refused: "extras-full" };
  return replaceRow(memo, rowId, (r) => ({ ...r, extras: [...r.extras, { pattern, memories: [memory] }] }));
}

/** The group's memory at `index` with other tiers, in its place (D18). */
export function changeMemory(memo: Memo, rowId: string, pattern: GroupPattern, index: number, memory: Memory): Memo {
  return replaceRow(memo, rowId, (row) =>
    changeGroup(row, pattern, (memories) => {
      checkIndex(memories, index, `${rowId} ${pattern}`);
      return memories.with(index, memory);
    }),
  );
}

/** The group without its memory at `index` (D4); an extra group left empty stays (D27). */
export function deleteMemory(memo: Memo, rowId: string, pattern: GroupPattern, index: number): Memo {
  return replaceRow(memo, rowId, (row) =>
    changeGroup(row, pattern, (memories) => {
      checkIndex(memories, index, `${rowId} ${pattern}`);
      return memories.toSpliced(index, 1);
    }),
  );
}

/** The row without one of its extra groups and that group's memories, removed by hand (D27). */
export function removeExtraGroup(memo: Memo, rowId: string, pattern: ExtraPattern): Memo {
  return replaceRow(memo, rowId, (row) => {
    if (!row.extras.some((g) => g.pattern === pattern)) throw new MemoEditError(`row ${row.id} has no ${pattern} group`);
    return { ...row, extras: row.extras.filter((g) => g.pattern !== pattern) };
  });
}
