/**
 * The page's Worker: the built page from the static assets, the skill card sprite sheets and their
 * index from R2 (img.ts), and the sibling's skill card data at this origin (data.ts). Only `/img/*`
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

/** Cloudflare's own fetch option: keep the sibling's file in this Worker's edge cache for an hour too. */
const EDGE_CACHE: RequestInit & { cf: { cacheTtl: number } } = { cf: { cacheTtl: 3600 } };

export function route(request: Request, env: Env, fetchUpstream: (url: string) => Promise<Response>): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/img/")) return serveImage(request, env.IMAGES);
  if (pathname === SKILLCARDS_ROUTE) return serveSkillCards(request, fetchUpstream);
  return env.ASSETS.fetch(request);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env, (url) => fetch(url, EDGE_CACHE));
  },
};
