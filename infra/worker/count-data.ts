/**
 * The count rules of the current skill card file, for `POST /count` (docs/plans/EXECPLAN_MEMORY_MEMO.md,
 * D30): the file the Worker passes through at /data/skillcards.json (data.ts), fetched from the
 * sibling and checked whole by the page's own reader (src/data/load.ts). The rules are kept in the
 * Worker's isolate for an hour, as long as the file's own cache, so most events reuse them instead
 * of reading 190 KB of JSON again.
 */

import { parseSkillCardData } from "../../src/data/load.ts";
import { countRules, type CountRules } from "./count-event.ts";
import { SKILLCARDS_SOURCE } from "./data.ts";

/** How long the rules of one file are used before the file is fetched again. */
export const RULES_TTL_MS = 3_600_000;

/** The rules of the file upstream, or null when it cannot be fetched or does not match the contract. */
export async function fetchRules(fetchUpstream: (url: string) => Promise<Response>): Promise<CountRules | null> {
  try {
    const response = await fetchUpstream(SKILLCARDS_SOURCE);
    if (!response.ok) return null;
    return countRules(parseSkillCardData(await response.json()));
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
