/**
 * Skill card icons as cells of this app's game-style sprite sheets (docs/plans/
 * EXECPLAN_GAME_STYLE_ICONS.md, I2, I3 and I5; docs/adr/0002). The index is committed as
 * src/icons/index.v1.json and bundled: per plan, the cells every sheet of the plan holds, in order,
 * as `<card id>:<level>`, and each idol's sheet. A card the index lacks (one the game added after
 * the last screenshots) is drawn as the empty frame of its rarity and type, a cell of
 * /icons/frames112.webp, with its name over it.
 */

import { imageKey, SHEETS } from "../../infra/worker/img.ts";
import type { SkillCardRarity, SkillCardType } from "../data/contract.ts";
import { child, fail, integer, isFields, list, object, oneOf, type Read, ReadError, req, string } from "../lib/read.ts";
import { PLAN_IDS, type PlanId } from "../memo/types.ts";
import committed from "../icons/index.v1.json" with { type: "json" };

export interface PlanSheets {
  plan: PlanId;
  /** Every sheet's cells of this plan, row by row, as `<card id>:<level>`. */
  cells: readonly string[];
  sheets: readonly { idol: string; file: string }[];
}

export interface IconIndex {
  /** A cell's width and height in the sheets' pixels. */
  cell: number;
  columns: number;
  plans: readonly PlanSheets[];
}

/** No sheets: every card is drawn as its frame with its name. */
export const NO_ICONS: IconIndex = { cell: 112, columns: 10, plans: [] };

/** The index does not have its shape; the message names where. */
export class IconIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IconIndexError";
  }
}

const positive: Read<number> = (value, path) => {
  const n = integer(value, path);
  return n > 0 ? n : fail(path, "a positive integer");
};

const cellName: Read<string> = (value, path) => {
  const s = string(value, path);
  return /^p_card-\d{2}-[a-z]{3}-\d+_\d{3}:[01]$/.test(s) ? s : fail(path, "a card and level, p_card-…:0 or :1");
};

/** A sheet of `plan`: only a name the Worker serves, named for its own plan and idol, which also keeps anything else out of the CSS url(). */
function sheetOf(plan: PlanId): Read<{ idol: string; file: string }> {
  return (value, path) => {
    const f = object(value, path);
    const idol = req(f, "idol", string, path);
    const file = req(f, "file", string, path);
    if (imageKey(`${SHEET_URL_PREFIX}${file}`) !== file || !file.startsWith(`${SHEETS}/${plan}-${idol}-`)) fail(child(path, "file"), `the sheet of ${plan} and ${idol}`);
    return { idol, file };
  };
}

const planSheets: Read<PlanSheets> = (value, path) => {
  const f = object(value, path);
  const plan = req(f, "plan", oneOf(PLAN_IDS), path);
  return { plan, cells: req(f, "cells", list(cellName), path), sheets: req(f, "sheets", list(sheetOf(plan)), path) };
};

/** The index, checked whole; throws `IconIndexError` at the first value that does not match. */
export function parseIconIndex(json: unknown): IconIndex {
  try {
    if (!isFields(json)) fail("the icon index", "an object");
    if (json["formatVersion"] !== 1) fail("formatVersion", "1");
    const plans = req(json, "plans", list(planSheets), "");
    if (new Set(plans.map((p) => p.plan)).size !== plans.length) fail("plans", "each plan once");
    return { cell: req(json, "cell", positive, ""), columns: req(json, "columns", positive, ""), plans };
  } catch (error) {
    if (error instanceof ReadError) throw new IconIndexError(error.message);
    throw error;
  }
}

/** The committed index; if it were malformed every card would be drawn as its frame, and the console says why. */
export function bundledIcons(json: unknown = committed): IconIndex {
  try {
    return parseIconIndex(json);
  } catch (error) {
    console.error("icons drawn as frames:", error);
    return NO_ICONS;
  }
}

/** Where the page asks for a sheet: the Worker's `/img/*` (infra/worker/img.ts), then the sheet's file. */
export const SHEET_URL_PREFIX = "/img/";

/** Where an icon is: its sheet's URL and layout, and its cell's place in it. */
export interface IconCell {
  url: string;
  columns: number;
  rows: number;
  index: number;
}

/** A card at a level, as the index names it. */
export interface CardRef {
  id: string;
  upgrade: number;
}

/**
 * The game-style icon of a card shown in a tab of `plan`, in the chosen idol's art (D20 of the memo
 * plan), else the default idol's (D20's fallback, D34), else null.
 */
export function iconCell(index: IconIndex, plan: PlanId, card: CardRef, idol: string, defaultIdol: string): IconCell | null {
  const found = index.plans.find((p) => p.plan === plan);
  const at = found?.cells.indexOf(`${card.id}:${card.upgrade}`) ?? -1;
  if (found === undefined || at < 0) return null;
  const sheet = found.sheets.find((s) => s.idol === idol) ?? found.sheets.find((s) => s.idol === defaultIdol);
  if (sheet === undefined) return null;
  return { url: `${SHEET_URL_PREFIX}${sheet.file}`, columns: index.columns, rows: Math.ceil(found.cells.length / index.columns), index: at };
}

/** The placeholder frames, a static file of the page: one row, in this order (scripts/icons/frames.py). */
export const FRAMES_URL = "/icons/frames112.webp";
export const FRAME_ORDER: readonly string[] = ["N-active", "N-mental", "R-active", "R-mental", "SR-active", "SR-mental", "SSR-active", "SSR-mental"];

/** The empty frame of a rarity and type, or null for one the frames lack (Legend, which the pool has none of). */
export function frameCell(rarity: SkillCardRarity, type: SkillCardType): IconCell | null {
  const at = FRAME_ORDER.indexOf(`${rarity}-${type}`);
  return at < 0 ? null : { url: FRAMES_URL, columns: FRAME_ORDER.length, rows: 1, index: at };
}

/**
 * The CSS that draws the cell `size` square (a CSS length, such as `var(--icon)`, so one rule
 * serves the phone and the desktop sizes), the sheet scaled to match.
 */
export function spriteStyle(cell: IconCell, size: string): Record<string, string> {
  const column = cell.index % cell.columns;
  const row = Math.floor(cell.index / cell.columns);
  return {
    width: size,
    height: size,
    backgroundImage: `url("${cell.url}")`,
    backgroundSize: `calc(${cell.columns} * ${size}) calc(${cell.rows} * ${size})`,
    backgroundPosition: `calc(${-column} * ${size}) calc(${-row} * ${size})`,
  };
}
