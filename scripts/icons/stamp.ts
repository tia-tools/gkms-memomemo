/**
 * Stamps each built cell with the fingerprint of what the game drew when its screenshot was taken
 * (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I9), for the daily check to compare with the game's
 * current tables. A cell built again from the same screenshot keeps its stamp, so rebuilding after
 * a game update cannot make a stale icon look fresh; a new or retaken screenshot is stamped with
 * the tables as they are now.
 *
 *     bun scripts/icons/stamp.ts [--tables <path or URL of ProduceCard.yaml>]
 *
 * Reads scripts/icons/out/cells.json (build.py: each cell's screenshot hash) and the committed
 * scripts/icons/stamps.json, and writes stamps.json.
 */

import { fail, isFields, object, type Read, ReadError, req, string } from "../../src/lib/read.ts";
import { loadFingerprints, PRODUCE_CARD_URL } from "./fingerprint.ts";

export interface Stamp {
  shot: string;
  fingerprint: string;
}

export interface Stamps {
  formatVersion: 1;
  cells: Record<string, Stamp>;
}

const hex8: Read<string> = (value, path) => {
  const s = string(value, path);
  return /^[0-9a-f]{8}$/.test(s) ? s : fail(path, "8 hex digits");
};

const stampRead: Read<Stamp> = (value, path) => {
  const f = object(value, path);
  return { shot: req(f, "shot", hex8, path), fingerprint: req(f, "fingerprint", hex8, path) };
};

function recordOf<T>(item: Read<T>): Read<Record<string, T>> {
  return (value, path) => Object.fromEntries(Object.entries(object(value, path)).map(([k, v]) => [k, item(v, `${path}.${k}`)]));
}

/** The stamps file, checked whole. */
export function parseStamps(json: unknown): Stamps {
  if (!isFields(json) || json["formatVersion"] !== 1) fail("stamps", "an object with formatVersion 1");
  return { formatVersion: 1, cells: req(json, "cells", recordOf(stampRead), "stamps") };
}

/** Each cell's screenshot hash, as build.py writes it. */
export const parseCells: (json: unknown) => Record<string, string> = (json) => recordOf(hex8)(json, "cells");

export interface Stamped {
  stamps: Stamps;
  /** Cells given the current fingerprint: new, or built from another screenshot than before. */
  restamped: string[];
}

/** The stamps of the built cells; a cell the tables lack is refused, since nothing could tell when it changes. */
export function stamp(previous: Stamps | null, cells: Record<string, string>, current: ReadonlyMap<string, string>): Stamped {
  const out: Record<string, Stamp> = {};
  const restamped: string[] = [];
  for (const cell of Object.keys(cells).sort()) {
    const shot = cells[cell] ?? "";
    const before = previous?.cells[cell];
    if (before !== undefined && before.shot === shot) {
      out[cell] = before;
      continue;
    }
    const now = current.get(cell);
    if (now === undefined) throw new Error(`${cell}: not in ProduceCard.yaml`);
    out[cell] = { shot, fingerprint: now };
    restamped.push(cell);
  }
  return { stamps: { formatVersion: 1, cells: out }, restamped };
}

if (import.meta.main) {
  const at = Bun.argv.indexOf("--tables");
  const tables = at > 0 ? (Bun.argv[at + 1] ?? PRODUCE_CARD_URL) : PRODUCE_CARD_URL;
  const here = new URL(".", import.meta.url).pathname;
  const stampsFile = Bun.file(`${here}stamps.json`);
  try {
    const previous = (await stampsFile.exists()) ? parseStamps(await stampsFile.json()) : null;
    const cells = parseCells(await Bun.file(`${here}out/cells.json`).json());
    const { stamps, restamped } = stamp(previous, cells, await loadFingerprints(tables));
    await Bun.write(stampsFile, `${JSON.stringify(stamps, null, 1)}\n`);
    console.log(`${Object.keys(stamps.cells).length} cells stamped, ${restamped.length} with the current tables`);
  } catch (error) {
    console.error(error instanceof ReadError || error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
