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
  /**
   * gkms-library's origin (src/data/library.ts), whose data the page fetches and whose faces it draws
   * (docs/plans/EXECPLAN_LIBRARY_DATA.md, L5 and L6). The worker cannot import library.ts, which the
   * page shares, so the build writes these in.
   */
  library: string;
  /** The library's pointer, by its path there: `/data/latest.v1.json`. */
  pointer: string;
  /**
   * The directories of the releases the page reads, by their paths there (`/data/skill-cards/v1/`,
   * `/data/idols/v1/`). The pointer also names releases of formats the page never fetches, which
   * must not count toward its set (#116).
   */
  releaseDirs: readonly string[];
  /** Where the sprite sheets are (infra/worker/img.ts). */
  sheetPrefix: string;
  /** Every sheet the bundled index names (src/icons/index.v1.json); a kept sheet it no longer names is dropped. */
  sheets: readonly string[];
  /** Where the build puts the font's files (vite.config.ts). */
  fontPrefix: string;
  /** Every font file the build wrote; a kept one it no longer wrote is dropped. */
  fonts: readonly string[];
}

/**
 * - `page`: a navigation, from the network while there is one, else the page kept at install, so a
 *   page online is always the one deployed;
 * - `precached`: a file of the page, from the cache, since its name or the worker changes with it;
 * - `pointer`: the library's pointer, from the network, the last copy kept for when there is none;
 * - `release`: a release of the library's data, from the cache once fetched, its name never getting
 *   other content;
 * - `face`: an idol's face at the library's address, from the cache once drawn, likewise;
 * - `sheet`: a sprite sheet, from the cache once shown, its name never changing meaning;
 * - `font`: a slice of the font, from the cache once used, its name holding its hash (D68): kept
 *   as the page needs it rather than at install, since the page uses a few of its slices;
 * - `network`: anything else, left to the browser as if there were no service worker.
 */
export type Route = "page" | "precached" | "pointer" | "release" | "face" | "sheet" | "font" | "network";

export interface RequestFacts {
  url: string;
  method: string;
  /** `request.mode === "navigate"`, which a test cannot construct. */
  navigate: boolean;
}

/** A release's path at the library: `data/<format>/v<N>/<release>.json`. */
const RELEASE = /^\/data\/[a-z-]+\/v\d+\/[^/]+\.json$/;
/** An idol's face at the library: `img/w112/img_sd_<idol id>_face-00.webp`. */
const FACE = /^\/img\/w112\/img_sd_[a-z0-9]{4}_face-00\.webp$/;

/** Whether a path at the library is a release of a format the page reads. */
function isRelease(pathname: string, manifest: SwManifest): boolean {
  return RELEASE.test(pathname) && manifest.releaseDirs.some((dir) => pathname.startsWith(dir));
}

/** The route of a GET to the library's origin with no query; anything else there is left to the browser. */
function libraryRoute(pathname: string, manifest: SwManifest): Route {
  if (pathname === manifest.pointer) return "pointer";
  if (isRelease(pathname, manifest)) return "release";
  return FACE.test(pathname) ? "face" : "network";
}

export function routeOf(request: RequestFacts, origin: string, manifest: SwManifest): Route {
  const url = new URL(request.url);
  if (request.method !== "GET") return "network";
  if (url.origin === manifest.library) return url.search === "" ? libraryRoute(url.pathname, manifest) : "network";
  if (url.origin !== origin) return "network";
  if (request.navigate) return "page";
  if (url.search !== "") return "network";
  if (url.pathname.startsWith(manifest.sheetPrefix)) return "sheet";
  if (url.pathname.startsWith(manifest.fontPrefix)) return "font";
  return manifest.precache.includes(url.pathname) ? "precached" : "network";
}

/** Every cache this page's service worker makes starts so, and it deletes no other. */
export const CACHE_PREFIX = "memomemo-";

export interface CacheNames {
  page: string;
  /** The library's pointer and the releases it names: always a complete set, so the page can start offline from it. */
  data: string;
  /** A fresh pointer whose releases are not all kept yet; it replaces the one in `data` once they are. */
  next: string;
  sheets: string;
  fonts: string;
  faces: string;
}

/** The page's cache is per version; the data, the sheets, the font and the faces outlive a deploy. */
export function cacheNames(version: string): CacheNames {
  return {
    page: `${CACHE_PREFIX}page-${version}`,
    data: `${CACHE_PREFIX}data`,
    next: `${CACHE_PREFIX}data-next`,
    sheets: `${CACHE_PREFIX}sheets`,
    fonts: `${CACHE_PREFIX}fonts`,
    faces: `${CACHE_PREFIX}faces`,
  };
}

/** The cache a kept route's answers go in, or null for a route the worker does not keep that way. */
export function cacheOf(route: Route, names: CacheNames): string | null {
  switch (route) {
    case "pointer":
      return names.next;
    case "release":
      return names.data;
    case "face":
      return names.faces;
    case "sheet":
      return names.sheets;
    case "font":
      return names.fonts;
    default:
      return null;
  }
}

/**
 * The paths of the releases the page reads that a kept pointer names, read loosely: the page checks
 * the pointer whole with its format, which the worker cannot import. The releases of other formats
 * it names are left out, since the page never fetches them (#116). Null when it has no list of
 * paths, so nothing is dropped on its word.
 */
export function pointedReleases(json: unknown, manifest: SwManifest): string[] | null {
  if (typeof json !== "object" || json === null || !("files" in json) || !Array.isArray(json.files)) return null;
  const paths: string[] = [];
  for (const file of json.files) {
    if (typeof file !== "object" || file === null || !("path" in file) || typeof file.path !== "string") return null;
    paths.push(`/${file.path}`);
  }
  return paths.filter((path) => isRelease(path, manifest));
}

/** The releases of `named` (paths at the library) that `kept` (absolute URLs) does not hold yet. */
export function missingReleases(named: readonly string[], kept: readonly string[], manifest: SwManifest): string[] {
  const held = new Set(kept);
  return named.filter((path) => !held.has(new URL(path, manifest.library).href));
}

/**
 * Of the data cache's kept URLs, those to delete: anything that is neither the library's pointer
 * nor a release of it (such as the skill card file this page read before it moved to the library),
 * and, when `named` is given, a release the kept pointer no longer names.
 */
export function staleData(kept: readonly string[], named: readonly string[] | null, manifest: SwManifest): string[] {
  return kept.filter((url) => {
    const at = new URL(url);
    if (at.origin !== manifest.library || at.search !== "") return true;
    if (at.pathname === manifest.pointer) return false;
    if (!isRelease(at.pathname, manifest)) return true;
    return named !== null && !named.includes(at.pathname);
  });
}

/** The caches an activation deletes: this page's caches the version does not use, so earlier versions' pages. */
export function staleCaches(existing: readonly string[], version: string): string[] {
  const used = new Set(Object.values(cacheNames(version)));
  return existing.filter((name) => name.startsWith(CACHE_PREFIX) && !used.has(name));
}

/** The kept files (their URLs) whose paths `named` no longer holds: the sheets the bundled index, or the font files the build, no longer names. */
export function staleKept(kept: readonly string[], named: readonly string[]): string[] {
  const current = new Set(named);
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
 * keep for offline use: the library's pointer and releases, the faces, the sheets and the font's slices. Anything else named is ignored, so a message
 * cannot make the worker fetch what it would not keep anyway.
 */
export function worthKeeping(urls: readonly unknown[], origin: string, manifest: SwManifest): string[] {
  const keep = urls.filter((url): url is string => typeof url === "string" && parses(url));
  const routes = keep.map((url) => routeOf({ url, method: "GET", navigate: false }, origin, manifest));
  return [...new Set(keep.filter((_, i) => cacheOf(routes[i] ?? "network", cacheNames("")) !== null))];
}
