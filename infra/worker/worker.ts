/**
 * The page's Worker: the built page from the static assets, this app's game-style skill card sprite
 * sheets from R2 (img.ts), and the sibling's skill card data at this origin (data.ts). Only `/img/*`
 * and `/data/skillcards.json` need this code; `run_worker_first` in wrangler.toml sends just those
 * here, and every other request costs no Worker request on the Free plan (decision D42 of
 * docs/plans/EXECPLAN_MEMORY_MEMO.md).
 */

import { SKILLCARDS_ROUTE, serveSkillCards } from "./data.ts";
import { serveImage, type ImageBucket } from "./img.ts";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: ImageBucket;
}

/**
 * The paths this code answers, in `run_worker_first`'s pattern syntax: wrangler.toml must list
 * exactly these (wrangler.test.ts), and `route` sends everything else to the assets.
 */
export const WORKER_FIRST = ["/img/*", SKILLCARDS_ROUTE] as const;

function answeredHere(pathname: string): boolean {
  return WORKER_FIRST.some((pattern) => (pattern.endsWith("/*") ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern));
}

/** Cloudflare's own fetch option: keep the sibling's file in this Worker's edge cache for an hour too. */
const EDGE_CACHE: RequestInit & { cf: { cacheTtl: number } } = { cf: { cacheTtl: 3600 } };

export function route(request: Request, env: Env, fetchUpstream: (url: string) => Promise<Response>): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!answeredHere(pathname)) return env.ASSETS.fetch(request);
  return pathname === SKILLCARDS_ROUTE ? serveSkillCards(request, fetchUpstream) : serveImage(request, env.IMAGES);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env, (url) => fetch(url, EDGE_CACHE));
  },
};
