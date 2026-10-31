/**
 * Reads a memo from untrusted JSON: a 引き継ぎコード's contents (code.ts) and, from Milestone 5, the
 * memo saved in the browser. The whole memo is checked and copied into fresh objects; anything that
 * does not match refuses all of it with the path of the first bad value, so a memo is never
 * imported in part. Ids are checked for the shape of the game's ids only: a well-formed id the data
 * file does not have is kept (D31). Beyond the types, it refuses what the edits never make
 * (edit.ts): two rows with one id, an extra group with no memory or a pattern repeated, more than
 * two extra groups, and one build twice in a tab (D13).
 */

import { boolean, child, integer, list, object, oneOf, type Read, ReadError, req, string } from "../lib/read.ts";
import { buildKey } from "./build.ts";
import {
  type Build,
  type ChosenStep,
  emptyMemo,
  EXTRA_PATTERNS,
  type ExtraGroup,
  MAX_EXTRAS,
  type Memo,
  type Memory,
  PLAN_IDS,
  type Row,
  SECTION_IDS,
  sectionsOf,
  TIERS,
} from "./types.ts";

/** The memo does not have the shape the page saves; the message names where. */
export class MemoFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoFormatError";
  }
}

/**
 * The shapes of the ids a memo holds: the game's card, customization kind and memory ability ids
 * as the data file writes them (p_card-01-act-3_029, p_card_custom-070-…, memory_ability-…), and a
 * row's own random id. Bounded, so a code cannot carry an id of any length.
 */
export const ID_SHAPES = {
  card: /^p_card-[0-9]{2}-[a-z]{3}-[0-9]{1,4}_[0-9]{1,4}$/,
  kind: /^p_card_custom-[0-9a-z_-]{1,500}$/,
  hif: /^memory_ability-[0-9a-z_-]{1,300}$/,
  row: /^[0-9A-Za-z_-]{1,64}$/,
} as const;

/** The highest customization step the game has; a step above it is no step of any card. */
const MAX_STEP = 9;

function matching(shape: RegExp, what: string): Read<string> {
  return (value, path) => {
    const text = string(value, path);
    if (!shape.test(text)) throw new ReadError(`${path}: expected ${what}`);
    return text;
  };
}

function between(min: number, max: number): Read<number> {
  return (value, path) => {
    const n = integer(value, path);
    if (n < min || n > max) throw new ReadError(`${path}: expected ${min} to ${max}`);
    return n;
  };
}

const chosenStep: Read<ChosenStep> = (value, path) => {
  const f = object(value, path);
  return { kind: req(f, "kind", matching(ID_SHAPES.kind, "a customization id"), path), step: req(f, "step", between(1, MAX_STEP), path) };
};

const build: Read<Build> = (value, path) => {
  const f = object(value, path);
  return {
    card: req(f, "card", matching(ID_SHAPES.card, "a skill card id"), path),
    // D37: base or + only.
    upgrade: req(f, "upgrade", between(0, 1), path),
    customization: req(f, "customization", list(chosenStep), path),
    kaimaku: req(f, "kaimaku", boolean, path),
    hif: req(f, "hif", matching(ID_SHAPES.hif, "an H.I.F. ability id"), path),
  };
};

/**
 * The reader's message for a build that breaks the memo's shapes (D46), or null. edit.ts refuses such
 * a build before it enters a memo, so every memo the edits make is one `readMemo` accepts.
 */
export function buildShapeError(value: Build): string | null {
  try {
    build(value, "build");
    return null;
  } catch (error) {
    if (error instanceof ReadError) return error.message;
    throw error;
  }
}

const memory: Read<Memory> = (value, path) => {
  const tiers = list(oneOf(TIERS))(value, path);
  const [vo, da, vi] = tiers;
  if (tiers.length !== 3 || vo === undefined || da === undefined || vi === undefined) throw new ReadError(`${path}: expected three tiers, Vo, Da, Vi`);
  return [vo, da, vi];
};

const extraGroup: Read<ExtraGroup> = (value, path) => {
  const f = object(value, path);
  const memories = req(f, "memories", list(memory), path);
  if (memories.length === 0) throw new ReadError(`${child(path, "memories")}: expected at least one memory`);
  return { pattern: req(f, "pattern", oneOf(EXTRA_PATTERNS), path), memories };
};

const extras: Read<ExtraGroup[]> = (value, path) => {
  const groups = list(extraGroup)(value, path);
  if (groups.length > MAX_EXTRAS) throw new ReadError(`${path}: expected at most ${MAX_EXTRAS} extra groups`);
  if (new Set(groups.map((g) => g.pattern)).size !== groups.length) throw new ReadError(`${path}: expected distinct patterns`);
  return groups;
};

const row: Read<Row> = (value, path) => {
  const f = object(value, path);
  const fixed = object(f["fixed"], child(path, "fixed"));
  const at = child(path, "fixed");
  return {
    id: req(f, "id", matching(ID_SHAPES.row, "a row id"), path),
    build: req(f, "build", build, path),
    fixed: { "%%F": req(fixed, "%%F", list(memory), at), "%F%": req(fixed, "%F%", list(memory), at), "F%%": req(fixed, "F%%", list(memory), at) },
    extras: req(f, "extras", extras, path),
  };
};

const sections: Read<Memo["sections"]> = (value, path) => {
  const f = object(value, path);
  const unknown = Object.keys(f).find((key) => !SECTION_IDS.some((s) => s === key));
  if (unknown !== undefined) throw new ReadError(`${child(path, unknown)}: expected no section of that name`);
  const read = emptyMemo().sections;
  for (const section of SECTION_IDS) read[section] = req(f, section, list(row), path);
  return read;
};

/** Two rows with one id, or one build twice in a tab, which no edit makes. */
function checkUnique(memo: Memo): void {
  const ids = new Set<string>();
  for (const plan of PLAN_IDS) {
    const builds = new Set<string>();
    for (const section of sectionsOf(plan)) {
      for (const [i, r] of memo.sections[section].entries()) {
        const at = `sections.${section}[${i}]`;
        if (ids.has(r.id)) throw new ReadError(`${at}.id: expected an id no other row has`);
        if (builds.has(buildKey(r.build))) throw new ReadError(`${at}.build: expected a build not already in the tab`);
        ids.add(r.id);
        builds.add(buildKey(r.build));
      }
    }
  }
}

function readWhole(json: unknown): Memo {
  const f = object(json, "the memo");
  if (f["formatVersion"] !== 1) throw new ReadError(`formatVersion: expected 1, not ${JSON.stringify(f["formatVersion"])}`);
  if (f["scenario"] !== "hif") throw new ReadError(`scenario: expected "hif"`);
  const memo: Memo = { formatVersion: 1, scenario: "hif", sections: req(f, "sections", sections, "") };
  checkUnique(memo);
  return memo;
}

/** The memo, checked whole; throws `MemoFormatError` at the first value that does not match. */
export function readMemo(json: unknown): Memo {
  try {
    return readWhole(json);
  } catch (error) {
    if (error instanceof ReadError) throw new MemoFormatError(error.message);
    throw error;
  }
}
