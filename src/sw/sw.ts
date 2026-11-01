/**
 * The service worker, built as `/sw.js` (vite.config.ts): it wires the worker's events to
 * handlers.ts, so the page installs and opens offline with its memo, its data file and the sheets it
 * has shown (docs/plans/EXECPLAN_MEMORY_MEMO.md, D32 and D58). `__SW_MANIFEST__` is written in at
 * build time; it appears here once, as the build checks. The worker's own types (its global scope
 * and events) are not in the page's DOM types, so the slices it uses are named here and checked at
 * run time, as infra/worker/img.ts does for R2.
 */

import { activate, install, keepLoaded, respond, type Worker } from "./handlers.ts";
import type { SwManifest } from "./routes.ts";

declare const __SW_MANIFEST__: SwManifest;

interface WorkerScope {
  addEventListener(type: string, listener: (event: Event) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
}

interface Extendable {
  waitUntil(promise: Promise<unknown>): void;
}

interface Fetching extends Extendable {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

function isWorkerScope(scope: unknown): scope is WorkerScope {
  return typeof scope === "object" && scope !== null && "skipWaiting" in scope && "clients" in scope && "addEventListener" in scope;
}

const isExtendable = (event: Event): event is Event & Extendable => "waitUntil" in event;
const isFetching = (event: Event): event is Event & Fetching => isExtendable(event) && "respondWith" in event && "request" in event;

/** A message from a page: `{ keep: [urls] }`, what it loaded before this worker controlled it. */
function keptUrls(event: Event): unknown[] | null {
  const data: unknown = "data" in event ? event.data : null;
  if (typeof data !== "object" || data === null || !("keep" in data) || !Array.isArray(data.keep)) return null;
  return data.keep;
}

function start(manifest: SwManifest): void {
  const scope: unknown = globalThis;
  if (!isWorkerScope(scope)) return;
  const worker: Worker = { caches, fetch: (request) => fetch(request), manifest, origin: location.origin };
  // A new version takes over at once: the page is one script, so an open page never asks this
  // worker for a file of another version.
  scope.addEventListener("install", (event) => {
    if (isExtendable(event)) event.waitUntil(install(worker).then(() => scope.skipWaiting()));
  });
  scope.addEventListener("activate", (event) => {
    if (isExtendable(event)) event.waitUntil(activate(worker).then(() => scope.clients.claim()));
  });
  scope.addEventListener("fetch", (event) => {
    if (!isFetching(event)) return;
    const answer = respond(event.request, { url: event.request.url, method: event.request.method, navigate: event.request.mode === "navigate" }, worker);
    if (answer !== null) event.respondWith(answer);
  });
  scope.addEventListener("message", (event) => {
    const urls = keptUrls(event);
    if (urls !== null && isExtendable(event)) event.waitUntil(keepLoaded(urls, worker));
  });
}

start(__SW_MANIFEST__);
