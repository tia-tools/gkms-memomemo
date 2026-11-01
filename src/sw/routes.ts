/**
 * What the service worker does with each request (docs/plans/EXECPLAN_MEMORY_MEMO.md, D32 and D58),
 * as pure rules. The service worker is built as its own script, `sw.js`, with no imports, so the
 * modules under src/sw/ import only each other: a module the page also imports would become a chunk
 * both share, which the build refuses (vite.config.ts). What the service worker needs to know of the
 * page is written into it at build time instead, as `SwManifest`.
 */

export interface SwManifest {
  /** Names the page's cache: a hash of every precached file's bytes, so a changed file means a new cache. */
  version: string;
  /** The page itself, fetched into its cache at install: `/`, the built scripts and styles, and public/'s files. */
  precache: readonly string[];
  /** The skill card data's route (infra/worker/data.ts). */
  data: string;
  /** Where the sprite sheets are (infra/worker/img.ts). */
  sheetPrefix: string;
  /** Every sheet the bundled index names (src/icons/index.v1.json); a kept sheet it no longer names is dropped. */
  sheets: readonly string[];
}

/**
 * - `page`: a navigation, from the network while there is one, else the page kept at install, so a
 *   page online is always the one deployed;
 * - `precached`: a file of the page, from the cache, since its name or the worker changes with it;
 * - `data`: the skill card file, from the network, the last copy kept for when there is none;
 * - `sheet`: a sprite sheet, from the cache once shown, its name never changing meaning;
 * - `network`: anything else, left to the browser as if there were no service worker.
 */
export type Route = "page" | "precached" | "data" | "sheet" | "network";

export interface RequestFacts {
  url: string;
  method: string;
  /** `request.mode === "navigate"`, which a test cannot construct. */
  navigate: boolean;
}

export function routeOf(request: RequestFacts, origin: string, manifest: SwManifest): Route {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return "network";
  if (request.navigate) return "page";
  if (url.search !== "") return "network";
  if (url.pathname === manifest.data) return "data";
  if (url.pathname.startsWith(manifest.sheetPrefix)) return "sheet";
  return manifest.precache.includes(url.pathname) ? "precached" : "network";
}

/** Every cache this page's service worker makes starts so, and it deletes no other. */
export const CACHE_PREFIX = "memomemo-";

export interface CacheNames {
  page: string;
  data: string;
  sheets: string;
}

/** The page's cache is per version; the data and the sheets outlive a deploy. */
export function cacheNames(version: string): CacheNames {
  return { page: `${CACHE_PREFIX}page-${version}`, data: `${CACHE_PREFIX}data`, sheets: `${CACHE_PREFIX}sheets` };
}

/** The caches an activation deletes: this page's caches the version does not use, so earlier versions' pages. */
export function staleCaches(existing: readonly string[], version: string): string[] {
  const used = new Set(Object.values(cacheNames(version)));
  return existing.filter((name) => name.startsWith(CACHE_PREFIX) && !used.has(name));
}

/** The kept sheets (their URLs) that the bundled index no longer names. */
export function staleSheets(kept: readonly string[], manifest: SwManifest): string[] {
  const current = new Set(manifest.sheets);
  return kept.filter((url) => !current.has(new URL(url).pathname));
}

/** Whether `url` is an absolute URL; `URL.canParse` is missing from Safari before 17. */
function parses(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Of the URLs a page loaded before its service worker controlled it (its first visit), those to
 * keep for offline use: the data file and the sheets. Anything else named is ignored, so a message
 * cannot make the worker fetch what it would not keep anyway.
 */
export function worthKeeping(urls: readonly unknown[], origin: string, manifest: SwManifest): string[] {
  const keep = urls.filter((url): url is string => typeof url === "string" && parses(url));
  const routes = keep.map((url) => routeOf({ url, method: "GET", navigate: false }, origin, manifest));
  return [...new Set(keep.filter((_, i) => routes[i] === "data" || routes[i] === "sheet"))];
}
