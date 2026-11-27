/**
 * The count rules of the current pool, for `POST /count` (docs/plans/EXECPLAN_MEMORY_MEMO.md, D30):
 * the pool the page itself reads, cut from gkms-library's newest releases by the page's own code
 * (src/data/library.ts, docs/plans/EXECPLAN_LIBRARY_DATA.md). The rules are kept in the Worker's
 * isolate for an hour, so most events reuse them instead of reading the library's files again.
 */

import { loadLibrary } from "../../src/data/library.ts";
import { countRules, type CountRules } from "./count-event.ts";

/** How long the rules of one file are used before the file is fetched again. */
export const RULES_TTL_MS = 3_600_000;

/** The rules of the library's pool, or null when a file cannot be fetched or does not have its format's shape. */
export async function fetchRules(fetchUpstream: (url: string) => Promise<Response>): Promise<CountRules | null> {
  try {
    return countRules(await loadLibrary(fetchUpstream));
  } catch {
    return null;
  }
}

/**
 * `load`'s rules, kept for `RULES_TTL_MS` from when they were had. While a reload fails, the last
 * rules had are used, so an event can still be checked; with none, the answer is null.
 */
export function keptRules(load: () => Promise<CountRules | null>, now: () => number): () => Promise<CountRules | null> {
  let kept: { rules: CountRules; at: number } | null = null;
  return async () => {
    if (kept !== null && now() - kept.at < RULES_TTL_MS) return kept.rules;
    const rules = await load();
    if (rules !== null) kept = { rules, at: now() };
    return rules ?? kept?.rules ?? null;
  };
}
