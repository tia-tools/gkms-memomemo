/**
 * The page's Worker: the built page from the static assets, this app's game-style skill card sprite
 * sheets from R2 (img.ts), the sibling's skill card data at this origin (data.ts), and the anonymous
 * counts in D1 (count.ts). Only `/img/*`, `/data/skillcards.json`, `/count` and `/counts` need this
 * code; `run_worker_first` in wrangler.toml sends just those here, and every other request costs no
 * Worker request on the Free plan (decisions D41 and D42 of docs/plans/EXECPLAN_MEMORY_MEMO.md).
 */

import { cleanCaps, type CountsCache, type CountsDb, handleCount, serveCounts } from "./count.ts";
import { COUNT_ROUTE, COUNTS_ROUTE } from "./count-contract.ts";
import type { CountRules } from "./count-event.ts";
import { fetchRules, keptRules } from "./count-data.ts";
import { SKILLCARDS_ROUTE, serveSkillCards } from "./data.ts";
import { serveImage, type ImageBucket } from "./img.ts";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: ImageBucket;
  /** The counts and the daily caps (migrations/). */
  DB: CountsDb;
  /** A Worker secret; see README.md § Counts. Nothing is counted while it is unset. */
  HASH_SALT?: string;
}

/** What a request may need besides its Env, passed in so a test needs no network, cache or clock. */
export interface Runtime {
  fetchUpstream: (url: string) => Promise<Response>;
  rules: () => Promise<CountRules | null>;
  cache: () => Promise<CountsCache>;
  waitUntil: (promise: Promise<unknown>) => void;
  now: () => Date;
  log: (line: string) => void;
}

/**
 * The paths this code answers, in `run_worker_first`'s pattern syntax: wrangler.toml must list
 * exactly these (wrangler.test.ts), and `route` sends everything else to the assets.
 */
export const WORKER_FIRST = ["/img/*", SKILLCARDS_ROUTE, COUNT_ROUTE, COUNTS_ROUTE] as const;

function answeredHere(pathname: string): boolean {
  return WORKER_FIRST.some((pattern) => (pattern.endsWith("/*") ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern));
}

export function route(request: Request, env: Env, runtime: Runtime): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!answeredHere(pathname)) return env.ASSETS.fetch(request);
  if (pathname === SKILLCARDS_ROUTE) return serveSkillCards(request, runtime.fetchUpstream);
  if (pathname === COUNT_ROUTE) return handleCount(request, { db: env.DB, salt: env.HASH_SALT, rules: runtime.rules, now: runtime.now, log: runtime.log });
  if (pathname === COUNTS_ROUTE) return serveCounts(request, { db: env.DB, cache: runtime.cache, waitUntil: runtime.waitUntil, log: runtime.log });
  return serveImage(request, env.IMAGES);
}

/** Cloudflare's own fetch option: keep the sibling's file in this Worker's edge cache for an hour too. */
const EDGE_CACHE: RequestInit & { cf: { cacheTtl: number } } = { cf: { cacheTtl: 3600 } };
const fetchUpstream = (url: string) => fetch(url, EDGE_CACHE);

/** Kept by the isolate across the requests it serves; see count-data.ts. */
const rules = keptRules(() => fetchRules(fetchUpstream), () => Date.now());

interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return route(request, env, {
      fetchUpstream,
      rules,
      cache: () => caches.open("counts"),
      waitUntil: (promise) => ctx.waitUntil(promise),
      now: () => new Date(),
      log: (line) => console.log(line),
    });
  },
  /** The daily Cron Trigger (wrangler.toml `[triggers]`). */
  scheduled(controller: { scheduledTime: number }, env: Env, ctx: Context): void {
    ctx.waitUntil(cleanCaps(env.DB, new Date(controller.scheduledTime), (line) => console.log(line)));
  },
};
