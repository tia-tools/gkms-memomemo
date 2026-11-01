/**
 * The anonymous counts in D1 (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 6, decisions D11, D12,
 * D30 and D41): `POST /count` adds 1 to each count a new row names, under an exact per-player daily
 * cap; `GET /counts` answers every count, cached for an hour; and the daily Cron Trigger deletes the
 * cap rows of past days. The tables are migrations/0001_counts.sql.
 *
 * The cap is one upsert whose `n = n + 1` applies only while `n` is under the cap, read back with
 * RETURNING: two events at once cannot both take the last place, so the cap is never overshot, and a
 * refused event writes nothing. The counts are then one batch of upserts, so `n = n + 1` cannot lose
 * an update when two players add rows at once.
 *
 * Everything the handlers touch is passed in, so `bun test` runs them over fake-d1.ts, which runs
 * this SQL on SQLite. The database type is the slice of Cloudflare's D1 used here, which keeps the
 * Workers type package out of the project.
 */

import { SECTION_IDS, type SectionId } from "../../src/memo/types.ts";
import { readCapped } from "./body.ts";
import { clientKey, utcDay } from "./client-key.ts";
import { COUNT_BODY_MAX, COUNT_KINDS, COUNTS_ROUTE, type CountKind, type CountsAnswer } from "./count-contract.ts";
import { type CountRow, type CountRules, parseCountEvent, type ReadEvent } from "./count-event.ts";

export interface D1Answer {
  results: Record<string, unknown>[];
  /** Rows written, as D1 bills them (a row and each index entry it changes). */
  meta: { rows_written: number };
}
export interface D1Statement {
  bind(...values: (string | number)[]): D1Statement;
  all(): Promise<D1Answer>;
  run(): Promise<D1Answer>;
}
export interface CountsDb {
  prepare(sql: string): D1Statement;
  /** Runs the statements in one transaction. */
  batch(statements: D1Statement[]): Promise<D1Answer[]>;
}

/** Count events one player may send per UTC day (D12, D41); a player setting up a tab sends a few dozen. */
export const DAILY_CAP = 200;

/** `?1` key, `?2` day, `?3` the cap: returns the new `n`, or no row when the cap was reached. */
export const CAP_SQL = "INSERT INTO caps (key, day, n) VALUES (?1, ?2, 1) ON CONFLICT (key) DO UPDATE SET n = n + 1 WHERE n < ?3 RETURNING n";
export const COUNT_SQL = "INSERT INTO counts (section, kind, id, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (section, kind, id) DO UPDATE SET n = n + 1";
export const COUNTS_SQL = "SELECT section, kind, id, n FROM counts";
export const CLEAN_SQL = "DELETE FROM caps WHERE day < ?1";

/** The counts change with every row any player creates; an hour keeps D1's reads low (D41). */
export const COUNTS_CACHE = "public, max-age=3600";

export interface CountDeps {
  db: CountsDb;
  /** The secret `HASH_SALT`, absent until it is set; nothing is counted without it. */
  salt: string | undefined;
  /** The rules of the current skill card file, or null when it cannot be had. */
  rules: () => Promise<CountRules | null>;
  now: () => Date;
  log: (line: string) => void;
}

function answer(status: number): Response {
  return new Response(JSON.stringify({ ok: status === 200 }) + "\n", {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * A browser sends `Origin` with every POST, and another site's page could otherwise have each of its
 * visitors count under their own cap (D63). A request without it (not from a browser) is still
 * capped. Under a `no-referrer` policy a browser sends `Origin: null`, which is refused too.
 */
function fromAnotherSite(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

async function readEvent(request: Request): Promise<ReadEvent | number> {
  const raw = await readCapped(request, COUNT_BODY_MAX);
  if (raw === null) return 413;
  return parseCountEvent(raw) ?? 400;
}

async function count(deps: CountDeps, key: string, day: string, rows: readonly CountRow[]): Promise<Response> {
  try {
    const cap = await deps.db.prepare(CAP_SQL).bind(key, day, DAILY_CAP).all();
    if (cap.results.length === 0) return answer(429);
    const counted = await deps.db.batch(rows.map((r) => deps.db.prepare(COUNT_SQL).bind(r.section, r.kind, r.id)));
    const written = counted.reduce((sum, r) => sum + r.meta.rows_written, 0);
    deps.log(`count: rows written ${cap.meta.rows_written} for the cap, ${written} for ${rows.length} counts`);
    return answer(200);
  } catch (error) {
    deps.log(`count: D1 failed: ${messageOf(error)}`);
    return answer(503);
  }
}

/**
 * `POST /count`: 405 for another method, 403 from another site's page, 413 over 1 KB, 400 for a body
 * that is not an event or names what the section's tab does not offer (D30), 503 while `HASH_SALT`
 * is unset or the skill card file or D1 cannot be had, 429 past the day's cap; 200 once counted.
 * Only a 200 has counted anything, and only a 200 or a D1 failure after the cap has used up a place.
 */
export async function handleCount(request: Request, deps: CountDeps): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed\n", { status: 405, headers: { Allow: "POST" } });
  if (fromAnotherSite(request)) return answer(403);
  const event = await readEvent(request);
  if (typeof event === "number") return answer(event);
  // Without the salt the daily key of an IPv4 address could be brute-forced, so no salt, no count.
  if (!deps.salt) return answer(503);
  // Cloudflare sets this on every request from outside; without it all such requests would share one cap.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return answer(400);
  const rules = await deps.rules();
  if (rules === null) {
    deps.log("count: the skill card file cannot be had");
    return answer(503);
  }
  const rows = rules(event);
  if (rows === null) return answer(400);
  const day = utcDay(deps.now());
  return count(deps, await clientKey(ip, day, deps.salt), day, rows);
}

export interface CountsCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface CountsDeps {
  db: CountsDb;
  /** Cloudflare's Cache API, in this data center. */
  cache: () => Promise<CountsCache>;
  /** Keeps the Worker running until the cache has stored the answer. */
  waitUntil: (promise: Promise<unknown>) => void;
  log: (line: string) => void;
}

type Grouped = Map<SectionId, Map<CountKind, [string, number][]>>;

function isCount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/**
 * Every count, by section and kind, from the rows of `COUNTS_SQL`; every section and kind is
 * present, an empty object where nothing was counted. A row that is not a count of a known section
 * and kind is left out. The objects are built from entries, so an id can never set a prototype.
 */
export function countsAnswer(rows: readonly Record<string, unknown>[]): CountsAnswer {
  const grouped: Grouped = new Map(SECTION_IDS.map((s) => [s, new Map(COUNT_KINDS.map((k) => [k, []]))]));
  for (const { section, kind, id, n } of rows) {
    const s = SECTION_IDS.find((known) => known === section);
    const k = COUNT_KINDS.find((known) => known === kind);
    if (s === undefined || k === undefined || typeof id !== "string" || !isCount(n)) continue;
    grouped.get(s)?.get(k)?.push([id, n]);
  }
  const section = (s: SectionId) => {
    const kinds = grouped.get(s);
    const of = (k: CountKind) => Object.fromEntries(kinds?.get(k) ?? []);
    return { card: of("card"), hif: of("hif"), customization: of("customization") };
  };
  return {
    formatVersion: 1,
    sections: {
      "sense.kocho": section("sense.kocho"),
      "sense.shuchu": section("sense.shuchu"),
      "sense.common": section("sense.common"),
      "logic.yaruki": section("logic.yaruki"),
      "logic.koinsho": section("logic.koinsho"),
      "logic.common": section("logic.common"),
      "anomaly.tsuyoki": section("anomaly.tsuyoki"),
      "anomaly.zenryoku": section("anomaly.zenryoku"),
      "anomaly.common": section("anomaly.common"),
    },
  };
}

async function freshCounts(deps: CountsDeps, cache: CountsCache, key: Request): Promise<Response> {
  let rows: Record<string, unknown>[];
  try {
    rows = (await deps.db.prepare(COUNTS_SQL).all()).results;
  } catch (error) {
    deps.log(`counts: D1 failed: ${messageOf(error)}`);
    return new Response("Counts unavailable\n", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": COUNTS_CACHE };
  const response = new Response(JSON.stringify(countsAnswer(rows)), { status: 200, headers });
  deps.waitUntil(cache.put(key, response.clone()));
  return response;
}

/**
 * `GET /counts`: the counts from the cache, else from one query, then kept in the cache for an hour.
 * The cache key is the route alone, so a query string cannot skip the cache and read D1 on every
 * request. A D1 failure is a 503, never cached.
 */
export async function serveCounts(request: Request, deps: CountsDeps): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const key = new Request(new URL(COUNTS_ROUTE, request.url));
  const cache = await deps.cache();
  const response = (await cache.match(key)) ?? (await freshCounts(deps, cache, key));
  return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
}

/** The daily Cron Trigger: deletes the cap rows of days before `now`'s UTC day. */
export async function cleanCaps(db: CountsDb, now: Date, log: (line: string) => void): Promise<void> {
  const result = await db.prepare(CLEAN_SQL).bind(utcDay(now)).run();
  log(`caps: rows written ${result.meta.rows_written} deleting the rows of days before ${utcDay(now)}`);
}
