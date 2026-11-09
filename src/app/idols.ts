/**
 * The idols' faces for 「カードの絵柄」 (docs/plans/EXECPLAN_IDOL_ICON_TABLE.md, T2, T4, T5 and T7):
 * each playable idol's SD face, the small cartoon face the game uses in its menus, as one cell of
 * one sheet, a static file of the page under /icons/ written by scripts/icons/idols.py. The index
 * naming the sheet and the idol of each cell is committed as src/icons/idols.v1.json and bundled.
 * An idol is found by id, never by position; one the sheet lacks is drawn by the first character
 * of her name.
 */

import { fail, integer, isFields, list, type Read, ReadError, req, string } from "../lib/read.ts";
import committed from "../icons/idols.v1.json" with { type: "json" };
import type { IconCell } from "./sheets.ts";

export interface IdolIcons {
  /** A cell's width and height in the sheet's pixels. */
  cell: number;
  /** The sheet's file name under /icons/, `idols96-<8 hex>.webp`. */
  file: string;
  /** The idol of each cell, by id, in the sheet's order. */
  idols: readonly string[];
}

/** No sheet: every idol is drawn by the first character of her name. */
export const NO_IDOL_ICONS: IdolIcons = { cell: 96, file: "", idols: [] };

/** The index does not have its shape; the message names where. */
export class IdolIconsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdolIconsError";
  }
}

/** Only a name idols.py writes, which also keeps anything else out of the CSS url(). */
const sheetFile: Read<string> = (value, path) => {
  const s = string(value, path);
  return /^idols96-[0-9a-f]{8}\.webp$/.test(s) ? s : fail(path, "idols96-<8 hex>.webp");
};

const positive: Read<number> = (value, path) => {
  const n = integer(value, path);
  return n > 0 ? n : fail(path, "a positive integer");
};

/** The index, checked whole; throws `IdolIconsError` at the first value that does not match. */
export function parseIdolIcons(json: unknown): IdolIcons {
  try {
    if (!isFields(json)) fail("the idol icon index", "an object");
    if (json["formatVersion"] !== 1) fail("formatVersion", "1");
    const idols = req(json, "idols", list(string), "");
    if (new Set(idols).size !== idols.length) fail("idols", "each idol once");
    return { cell: req(json, "cell", positive, ""), file: req(json, "file", sheetFile, ""), idols };
  } catch (error) {
    if (error instanceof ReadError) throw new IdolIconsError(error.message);
    throw error;
  }
}

/** The committed index; if it were malformed every idol would be drawn by her name's first character, and the console says why. */
export function bundledIdolIcons(json: unknown = committed): IdolIcons {
  try {
    return parseIdolIcons(json);
  } catch (error) {
    console.error("idols drawn without faces:", error);
    return NO_IDOL_ICONS;
  }
}

/** Where the page asks for the sheet: a static file under public/icons/. */
export const IDOL_SHEET_PREFIX = "/icons/";

/** An idol's face as a cell of the sheet, found by her id, or null when the sheet lacks her. */
export function idolCell(icons: IdolIcons, idol: string): IconCell | null {
  const at = icons.idols.indexOf(idol);
  return at < 0 ? null : { url: `${IDOL_SHEET_PREFIX}${icons.file}`, columns: icons.idols.length, rows: 1, index: at };
}

/** What stands for an idol without a face: the first character of her name. */
export function fallbackGlyph(name: string): string {
  return Array.from(name)[0] ?? "?";
}
