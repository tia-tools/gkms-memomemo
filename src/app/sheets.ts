/**
 * Skill card icons as cells of the sprite sheets gakumas-supportcards builds (docs/plans/
 * EXECPLAN_MEMORY_MEMO.md, D20, D34, D42, and § Interfaces and Dependencies for the index's shape):
 * the index at /img/sheet112/index.v1.json names each sheet's plan, idol, file, column count and
 * cell contents in order, so an icon is found by its asset name and never by assuming an order. An
 * icon the index lacks is null, and the page draws the card's name instead.
 */

import { imageKey, INDEX_KEY } from "../../infra/worker/img.ts";
import { fail, integer, isFields, list, object, oneOf, type Read, ReadError, req, string } from "../lib/read.ts";
import { PLAN_IDS, type PlanId } from "../memo/types.ts";

export const SHEET_INDEX_ROUTE = `/img/${INDEX_KEY}`;

export interface Sheet {
  plan: PlanId;
  idol: string;
  /** The bucket key, `sheet112/<plan>-<idol>-<8 hex>.webp`, served at `/img/<file>`. */
  file: string;
  columns: number;
  /** The asset name in each cell, row by row. */
  assets: readonly string[];
}

export interface SheetIndex {
  /** A cell's width and height in the sheet's pixels. */
  cell: number;
  sheets: readonly Sheet[];
}

/** No sheets: every icon is drawn as the card's name. */
export const NO_SHEETS: SheetIndex = { cell: 112, sheets: [] };

/** The index could not be had or does not have its shape; the message names where. */
export class SheetIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetIndexError";
  }
}

/** Only a name the Worker serves as a sheet, which also keeps anything else out of the CSS url(). */
const sheetFile: Read<string> = (value, path) => {
  const file = string(value, path);
  return imageKey(`/img/${file}`) === file && file !== INDEX_KEY ? file : fail(path, "a sprite sheet's name");
};

const positive: Read<number> = (value, path) => {
  const n = integer(value, path);
  return n > 0 ? n : fail(path, "a positive integer");
};

const sheet: Read<Sheet> = (value, path) => {
  const f = object(value, path);
  return {
    plan: req(f, "plan", oneOf(PLAN_IDS), path),
    idol: req(f, "idol", string, path),
    file: req(f, "file", sheetFile, path),
    columns: req(f, "columns", positive, path),
    assets: req(f, "assets", list(string), path),
  };
};

/** The index, checked whole; throws `SheetIndexError` at the first value that does not match. */
export function parseSheetIndex(json: unknown): SheetIndex {
  try {
    if (!isFields(json)) fail("the sheet index", "an object");
    if (json["formatVersion"] !== 1) fail("formatVersion", "1");
    return { cell: req(json, "cell", positive, ""), sheets: req(json, "sheets", list(sheet), "") };
  } catch (error) {
    if (error instanceof ReadError) throw new SheetIndexError(error.message);
    throw error;
  }
}

/** The index from this origin; `get` is the fetch to use. Rejects with `SheetIndexError`. */
export async function loadSheetIndex(get: (url: string) => Promise<Response>): Promise<SheetIndex> {
  const response = await get(SHEET_INDEX_ROUTE);
  if (!response.ok) throw new SheetIndexError(`${SHEET_INDEX_ROUTE}: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SheetIndexError(`${SHEET_INDEX_ROUTE}: not JSON`);
  }
  return parseSheetIndex(json);
}

/** Where an icon is: its sheet's URL and layout, and its cell's place in it. */
export interface IconCell {
  url: string;
  columns: number;
  rows: number;
  index: number;
}

/** A card's art, as the data file gives it. */
export interface Art {
  asset: string;
  perIdol: boolean;
}

function cellIn(index: SheetIndex, plan: PlanId, idol: string, art: Art): IconCell | null {
  const found = index.sheets.find((s) => s.plan === plan && s.idol === idol);
  const at = found?.assets.indexOf(art.perIdol ? `${art.asset}-${idol}` : art.asset) ?? -1;
  if (found === undefined || at < 0) return null;
  return { url: `/img/${found.file}`, columns: found.columns, rows: Math.ceil(found.assets.length / found.columns), index: at };
}

/**
 * The icon of a card shown in a tab of `plan`, in the chosen idol's art (D20), else the default
 * idol's (D20's fallback, D34), else null.
 */
export function iconCell(index: SheetIndex, plan: PlanId, art: Art, idol: string, defaultIdol: string): IconCell | null {
  return cellIn(index, plan, idol, art) ?? (idol === defaultIdol ? null : cellIn(index, plan, defaultIdol, art));
}

/** The CSS that draws the cell at `size` pixels square, the sheet scaled to match. */
export function spriteStyle(cell: IconCell, size: number): Record<string, string> {
  const column = cell.index % cell.columns;
  const row = Math.floor(cell.index / cell.columns);
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("${cell.url}")`,
    backgroundSize: `${cell.columns * size}px ${cell.rows * size}px`,
    backgroundPosition: `${-column * size}px ${-row * size}px`,
  };
}
