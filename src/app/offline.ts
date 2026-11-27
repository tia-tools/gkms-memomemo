/**
 * The page's side of the service worker (docs/plans/EXECPLAN_MEMORY_MEMO.md, D32 and D58): it
 * registers `/sw.js`, and on a first visit, which the worker did not see, it tells the worker what
 * the page had loaded by then (the library's data and the sheets among them, the worker decides), so a page
 * opened once already opens offline. So too when a worker takes over a page it did not start with,
 * such as the first load after a deploy, when the version before answered the page's requests and
 * kept what it knew of (docs/plans/EXECPLAN_LIBRARY_DATA.md, Surprises & Discoveries). The browser's
 * objects are passed in, so this runs under `bun test`.
 */

/** The worker's script, at the root so that it controls the whole page. */
export const SW_URL = "/sw.js";

/** The slice of `navigator.serviceWorker` used here. */
export interface Workers {
  controller: { postMessage(message: unknown): void } | null;
  addEventListener(type: "controllerchange", listener: () => void): void;
  register(url: string): Promise<unknown>;
  ready: Promise<{ active: { postMessage(message: unknown): void } | null }>;
}

/**
 * Registers the worker; once it is active, a page it did not control at the start sends it
 * `{ keep: loaded() }`, and a page another worker controlled sends the same to each worker that
 * takes it over later. A request still on its way at that moment is left for the next visit.
 */
export async function startOffline(workers: Workers | undefined, loaded: () => string[]): Promise<void> {
  if (workers === undefined) return;
  const firstVisit = workers.controller === null;
  // On a first visit the worker that claims the page is told below, once it is ready.
  if (!firstVisit) workers.addEventListener("controllerchange", () => workers.controller?.postMessage({ keep: loaded() }));
  try {
    await workers.register(SW_URL);
    const registration = await workers.ready;
    if (firstVisit) registration.active?.postMessage({ keep: loaded() });
  } catch (error) {
    console.error("the page will not open offline:", error);
  }
}

/** The URLs of everything this page has loaded so far, from the browser's resource timing. */
export function loadedUrls(): string[] {
  return performance.getEntriesByType("resource").map((entry) => entry.name);
}
