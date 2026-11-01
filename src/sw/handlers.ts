/**
 * The service worker's events (docs/plans/EXECPLAN_MEMORY_MEMO.md, D32 and D58): install keeps the
 * page, activation drops what an earlier version kept, and each request is answered by its route
 * (routes.ts). The caches and the network are passed in, slices of the browser's own, so these run
 * under `bun test` with fakes; sw.ts wires them to the worker's events.
 */

import { cacheNames, type RequestFacts, routeOf, staleCaches, staleSheets, type SwManifest, worthKeeping } from "./routes.ts";

/** The slice of a `Cache` the worker uses. */
export interface CacheLike {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
  addAll(requests: string[]): Promise<void>;
  keys(): Promise<readonly Request[]>;
  delete(request: Request | string): Promise<boolean>;
}

/** The slice of `CacheStorage` the worker uses. */
export interface CachesLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export interface Worker {
  caches: CachesLike;
  fetch: (request: Request | string) => Promise<Response>;
  manifest: SwManifest;
  /** The page's origin; the worker answers nothing from another. */
  origin: string;
}

/** Keeps every file of the page; if one fails, the install fails and the version before stays in charge. */
export async function install(worker: Worker): Promise<void> {
  const page = await worker.caches.open(cacheNames(worker.manifest.version).page);
  await page.addAll([...worker.manifest.precache]);
}

/** Deletes earlier versions' pages and the sheets the bundled index no longer names. */
export async function activate(worker: Worker): Promise<void> {
  await Promise.all(staleCaches(await worker.caches.keys(), worker.manifest.version).map((name) => worker.caches.delete(name)));
  const sheets = await worker.caches.open(cacheNames(worker.manifest.version).sheets);
  const stale = staleSheets((await sheets.keys()).map((request) => request.url), worker.manifest);
  await Promise.all(stale.map((url) => sheets.delete(url)));
}

/** From the network, a copy kept when it answers 200; the copy when the network fails or answers otherwise. */
async function networkFirst(worker: Worker, request: Request, cache: CacheLike, key: string): Promise<Response> {
  let answer: Response;
  try {
    answer = await worker.fetch(request);
  } catch (error) {
    const kept = await cache.match(key);
    if (kept === undefined) throw error;
    return kept;
  }
  if (answer.ok) {
    await cache.put(key, answer.clone());
    return answer;
  }
  return (await cache.match(key)) ?? answer;
}

/** From the cache; from the network otherwise, keeping a 200 when `keep` is given. */
async function cacheFirst(worker: Worker, request: Request, cache: CacheLike, keep: boolean): Promise<Response> {
  const kept = await cache.match(request);
  if (kept !== undefined) return kept;
  const answer = await worker.fetch(request);
  if (keep && answer.status === 200) await cache.put(request, answer.clone());
  return answer;
}

/** The page kept at install, for a navigation the network cannot answer. */
async function pageOffline(worker: Worker, request: Request, page: CacheLike): Promise<Response> {
  try {
    return await worker.fetch(request);
  } catch (error) {
    const kept = await page.match(new URL("/", worker.origin).href);
    if (kept === undefined) throw error;
    return kept;
  }
}

/**
 * The answer to `request`, or null to leave it to the browser. A navigation's page is not kept from
 * the network: the page kept is always the one install kept, whose scripts are kept with it.
 */
export function respond(request: Request, facts: RequestFacts, worker: Worker): Promise<Response> | null {
  const names = cacheNames(worker.manifest.version);
  const open = (name: string) => worker.caches.open(name);
  switch (routeOf(facts, worker.origin, worker.manifest)) {
    case "network":
      return null;
    case "page":
      return open(names.page).then((page) => pageOffline(worker, request, page));
    case "precached":
      return open(names.page).then((page) => cacheFirst(worker, request, page, false));
    case "data":
      return open(names.data).then((data) => networkFirst(worker, request, data, new URL(worker.manifest.data, worker.origin).href));
    case "sheet":
      return open(names.sheets).then((sheets) => cacheFirst(worker, request, sheets, true));
  }
}

/**
 * Keeps what a page loaded before this worker controlled it (`urls`, its first visit's resources):
 * the data file and the sheets, fetched again, which the browser's HTTP cache answers. A failure
 * leaves that file to be kept on the next visit, when the worker sees its request.
 */
export async function keepLoaded(urls: readonly unknown[], worker: Worker): Promise<void> {
  const names = cacheNames(worker.manifest.version);
  const dataUrl = new URL(worker.manifest.data, worker.origin).href;
  await Promise.all(
    worthKeeping(urls, worker.origin, worker.manifest).map(async (url) => {
      const cache = await worker.caches.open(url === dataUrl ? names.data : names.sheets);
      if ((await cache.match(url)) !== undefined) return;
      const answer = await worker.fetch(url).catch(() => null);
      if (answer?.status === 200) await cache.put(url, answer);
    }),
  );
}
