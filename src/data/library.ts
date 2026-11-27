/**
 * The pool from gkms-library's address (docs/plans/EXECPLAN_LIBRARY_DATA.md, Milestone 2): the
 * pointer `data/latest.v1.json` names each format's newest release, and the releases of
 * `skill-cards` v1 and `idols` v1 are fetched, checked whole by their own format files
 * (src/data/formats/) and cut into this page's pool (src/data/pool.ts). A release's name never gets
 * other content, so the two are always a consistent pair once the pointer is read. `get` is the
 * fetch to use, passed in so a test needs no network, and `base` the address, so a check can read a
 * local copy of the library's output.
 */

import { parse as parseIdols } from "./formats/idols.v1.ts";
import { type Latest, parse as parseLatest } from "./formats/latest.v1.ts";
import { parse as parseSkillCards } from "./formats/skill-cards.v1.ts";
import { type Pool, pool } from "./pool.ts";

/** The library's public address; every file there is readable from any origin. */
export const LIBRARY = "https://gkms-library.tia.run";
/** The pointer, relative to the address: the one file that changes under its name, kept five minutes. */
export const POINTER = "data/latest.v1.json";
/**
 * Where the releases this page reads are, relative to the address: of the formats the pointer names
 * (idols, items, skill-cards, support-cards), only these two. The service worker counts only these
 * as the pointer's set (#116).
 */
export const RELEASE_DIRS = ["data/skill-cards/v1/", "data/idols/v1/"] as const;

/** A file could not be had or does not have its format's shape; the message names the file and where. */
export class LibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

type Get = (url: string) => Promise<Response>;

/** Where, relative to the address, the pointer says the newest release of this format at version 1 is. */
export function releasePath(pointer: Latest, format: "skill-cards" | "idols"): string {
  const entry = pointer.files.find((file) => file.format === format && file.formatVersion === 1);
  if (entry === undefined) throw new LibraryError(`${POINTER}: names no release of ${format} v1`);
  return entry.path;
}

/** The JSON at `url`, checked by `parse`; every failure becomes a `LibraryError` naming the URL. */
async function fetchChecked<T>(get: Get, url: string, parse: (data: unknown) => T): Promise<T> {
  let response: Response;
  try {
    response = await get(url);
  } catch (error) {
    throw new LibraryError(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new LibraryError(`${url}: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new LibraryError(`${url}: not JSON`);
  }
  try {
    return parse(json);
  } catch (error) {
    throw new LibraryError(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The pointer, checked by its format; rejects with `LibraryError`. */
export function fetchPointer(get: Get, base: string = LIBRARY): Promise<Latest> {
  return fetchChecked(get, `${base}/${POINTER}`, parseLatest);
}

/** What names the pool a pointer leads to: the two release paths, so a caller can tell a new pool from the one it has. */
export function poolKey(pointer: Latest): string {
  return `${releasePath(pointer, "skill-cards")} ${releasePath(pointer, "idols")}`;
}

/** The pool of the releases `pointer` names; rejects with `LibraryError` at the first file that cannot be had or read. */
export async function loadReleases(get: Get, pointer: Latest, base: string = LIBRARY): Promise<Pool> {
  const [skillCards, idols] = await Promise.all([
    fetchChecked(get, `${base}/${releasePath(pointer, "skill-cards")}`, parseSkillCards),
    fetchChecked(get, `${base}/${releasePath(pointer, "idols")}`, parseIdols),
  ]);
  try {
    return pool(skillCards, idols);
  } catch (error) {
    throw new LibraryError(error instanceof Error ? error.message : String(error));
  }
}

/** The pool of the library's newest releases; rejects with `LibraryError` at the first file that cannot be had or read. */
export async function loadLibrary(get: Get, base: string = LIBRARY): Promise<Pool> {
  return loadReleases(get, await fetchPointer(get, base), base);
}
