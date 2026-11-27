/**
 * The service worker's events (docs/plans/EXECPLAN_MEMORY_MEMO.md, D32 and D58): install keeps the
 * page, activation drops what an earlier version kept, and each request is answered by its route
 * (routes.ts). The caches and the network are passed in, slices of the browser's own, so these run
 * under `bun test` with fakes; sw.ts wires them to the worker's events.
 */

import { cacheNames, cacheOf, pointedReleases, type RequestFacts, routeOf, staleCaches, staleData, staleKept, type SwManifest, worthKeeping } from "./routes.ts";

/** The slice of a `Cache` the worker uses. */
export interface CacheLike {
  match(request: Request | string, options: { ignoreVary: boolean }): Promise<Response | undefined>;
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

/**
 * What a cache keeps for `request`. Each cache here keeps one answer per URL, so a `Vary` header on
 * it means nothing, and honouring it misses: a static server may answer `Vary: Origin`, and the
 * browser sends `Origin` with a module script's request but not with install's, so the page's own
 * script would not be found offline (seen with `vite preview`, D58).
 */
function kept(cache: CacheLike, request: Request | string): Promise<Response | undefined> {
  return cache.match(request, { ignoreVary: true });
}

/** Keeps every file of the page; if one fails, the install fails and the version before stays in charge. */
export async function install(worker: Worker): Promise<void> {
  const page = await worker.caches.open(cacheNames(worker.manifest.version).page);
  await page.addAll([...worker.manifest.precache]);
}

/** Drops what `named` no longer holds from one kept cache. */
async function dropStale(cache: CacheLike, named: readonly string[]): Promise<void> {
  const stale = staleKept((await cache.keys()).map((request) => request.url), named);
  await Promise.all(stale.map((url) => cache.delete(url)));
}

/** Drops from the data cache what is not the library's pointer or a release of it, and, with `named`, a release the pointer no longer names. */
async function dropStaleData(worker: Worker, data: CacheLike, named: readonly string[] | null): Promise<void> {
  const stale = staleData((await data.keys()).map((request) => request.url), named, worker.manifest);
  await Promise.all(stale.map((url) => data.delete(url)));
}

/**
 * Deletes earlier versions' pages, the sheets the bundled index no longer names, the font files the
 * build no longer wrote, and anything in the data cache that is not the library's (the skill card
 * file kept before the page moved to the library).
 */
export async function activate(worker: Worker): Promise<void> {
  await Promise.all(staleCaches(await worker.caches.keys(), worker.manifest.version).map((name) => worker.caches.delete(name)));
  const names = cacheNames(worker.manifest.version);
  await dropStale(await worker.caches.open(names.sheets), worker.manifest.sheets);
  await dropStale(await worker.caches.open(names.fonts), worker.manifest.fonts);
  await dropStaleData(worker, await worker.caches.open(names.data), null);
}

/** From the network, a copy kept when it answers 200; the copy when the network fails or answers otherwise. */
async function networkFirst(worker: Worker, request: Request, cache: CacheLike, key: string): Promise<Response> {
  let answer: Response;
  try {
    answer = await worker.fetch(request);
  } catch (error) {
    const copy = await kept(cache, key);
    if (copy === undefined) throw error;
    return copy;
  }
  if (answer.ok) {
    await cache.put(key, answer.clone());
    return answer;
  }
  return (await kept(cache, key)) ?? answer;
}

/** From the cache; from the network otherwise, keeping a 200 when `keep` is given. */
async function cacheFirst(worker: Worker, request: Request, cache: CacheLike, keep: boolean): Promise<Response> {
  const copy = await kept(cache, request);
  if (copy !== undefined) return copy;
  const answer = await worker.fetch(request);
  if (keep && answer.status === 200) await cache.put(request, answer.clone());
  return answer;
}

/**
 * The library's pointer, from the network with the last copy kept; once a fresh one is kept, the
 * releases it no longer names are dropped, so the data cache holds one consistent set.
 */
async function pointer(worker: Worker, request: Request, data: CacheLike): Promise<Response> {
  const answer = await networkFirst(worker, request, data, request.url);
  if (answer.ok) {
    const json: unknown = await answer
      .clone()
      .json()
      .catch(() => null);
    const named = pointedReleases(json);
    if (named !== null) await dropStaleData(worker, data, named);
  }
  return answer;
}

/** The page kept at install, for a navigation the network cannot answer. */
async function pageOffline(worker: Worker, request: Request, page: CacheLike): Promise<Response> {
  try {
    return await worker.fetch(request);
  } catch (error) {
    const copy = await kept(page, new URL("/", worker.origin).href);
    if (copy === undefined) throw error;
    return copy;
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
    case "pointer":
      return open(names.data).then((data) => pointer(worker, request, data));
    case "release":
      return open(names.data).then((data) => cacheFirst(worker, request, data, true));
    case "face":
      return open(names.faces).then((faces) => cacheFirst(worker, request, faces, true));
    case "sheet":
      return open(names.sheets).then((sheets) => cacheFirst(worker, request, sheets, true));
    case "font":
      return open(names.fonts).then((fonts) => cacheFirst(worker, request, fonts, true));
  }
}

/**
 * Keeps what a page loaded before this worker controlled it (`urls`, its first visit's resources):
 * the library's pointer and releases, the faces, the sheets and the font's slices, fetched again, which the
 * browser's HTTP cache answers. A failure leaves that file to be kept on the next visit, when the worker sees its request.
 */
export async function keepLoaded(urls: readonly unknown[], worker: Worker): Promise<void> {
  const names = cacheNames(worker.manifest.version);
  await Promise.all(
    worthKeeping(urls, worker.origin, worker.manifest).map(async (url) => {
      const name = cacheOf(routeOf({ url, method: "GET", navigate: false }, worker.origin, worker.manifest), names);
      if (name === null) return;
      const cache = await worker.caches.open(name);
      if ((await kept(cache, url)) !== undefined) return;
      const answer = await worker.fetch(url).catch(() => null);
      if (answer?.status === 200) await cache.put(url, answer);
    }),
  );
}
