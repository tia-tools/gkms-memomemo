/**
 * What the build writes into `sw.js` (docs/plans/EXECPLAN_MEMORY_MEMO.md, D58): the page's files to
 * keep, and a version that changes whenever one of their bytes does, so a deploy that changes any
 * file of the page makes a new `sw.js`, which the browser installs in place of the last. Run by
 * vite.config.ts at build time only; neither the page nor the worker imports it.
 */

import { createHash } from "node:crypto";
import type { SwManifest } from "./routes.ts";

/** One file the build writes, by its path in dist/, with its bytes. */
export interface BuiltFile {
  path: string;
  bytes: Uint8Array | string;
}

/** The service worker's own file, which is never kept by itself. */
export const SW_FILE = "sw.js";
/** Where `sw.js` reads its manifest; the build writes the manifest over this name, which must appear once. */
export const SW_MANIFEST_NAME = "__SW_MANIFEST__";

/** A built file's URL path: `index.html` is the page at `/`, which is how the Worker's assets serve it. */
function urlOf(path: string): string {
  return path === "index.html" ? "/" : `/${path}`;
}

/** Whether a built file is part of the page to keep: not the worker, not a source map, not Vite's own manifests. */
function kept(path: string): boolean {
  return path !== SW_FILE && !path.endsWith(".map") && !path.startsWith(".vite/");
}

export function swManifest(files: readonly BuiltFile[], sheets: readonly string[], data: string, sheetPrefix: string): SwManifest {
  const page = files.filter((f) => kept(f.path)).toSorted((a, b) => urlOf(a.path).localeCompare(urlOf(b.path)));
  const hash = createHash("sha256");
  for (const file of page) {
    hash.update(urlOf(file.path));
    hash.update("\0");
    hash.update(file.bytes);
    hash.update("\0");
  }
  return { version: hash.digest("hex").slice(0, 16), precache: page.map((f) => urlOf(f.path)), data, sheetPrefix, sheets: [...sheets].toSorted() };
}

/** `sw.js` with its manifest written in, or why not: the name must appear exactly once. */
export function withManifest(code: string, manifest: SwManifest): string {
  const parts = code.split(SW_MANIFEST_NAME);
  if (parts.length !== 2) throw new Error(`${SW_FILE}: expected ${SW_MANIFEST_NAME} once, found it ${parts.length - 1} times`);
  return parts.join(JSON.stringify(manifest));
}
