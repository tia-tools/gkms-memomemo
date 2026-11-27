/**
 * The pool for the icon scripts (check.ts, offered.ts), read from gkms-library by the page's own
 * code (src/data/library.ts, docs/plans/EXECPLAN_LIBRARY_DATA.md): from its address by default, or
 * from a local directory laid out like it, such as gkms-library's `out/site/` after
 * `bun run generate` there.
 */

import { LIBRARY, loadLibrary } from "../../src/data/library.ts";
import type { Pool } from "../../src/data/pool.ts";

/** A file of a local copy, answered as the address would: its bytes, or a 404. */
async function fromFile(path: string): Promise<Response> {
  const file = Bun.file(path);
  return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
}

/** The pool of the library at `source`, an http(s) address or a directory; rejects with `LibraryError`. */
export function readLibrary(source: string = LIBRARY): Promise<Pool> {
  return loadLibrary(/^https?:\/\//.test(source) ? (url) => fetch(url) : fromFile, source.replace(/\/+$/, ""));
}
