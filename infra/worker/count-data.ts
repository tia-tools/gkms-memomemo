/**
 * The count rules of the current pool, for `POST /count` (docs/plans/EXECPLAN_MEMORY_MEMO.md, D30):
 * the pool the page itself reads, cut from gkms-library's newest releases by the page's own code
 * (src/data/library.ts, docs/plans/EXECPLAN_LIBRARY_DATA.md). The Worker's isolate asks the pointer
 * again once it is as old as the page's copy can be (five minutes), so an event for a card the page
 * has just started offering is not refused; it reads and checks the releases, about 1 MB, only when
 * the pointer names new ones, since that parse is the costly step on the Free plan's CPU allowance.
 */

import { fetchPointer, loadReleases, poolKey } from "../../src/data/library.ts";
import type { Latest } from "../../src/data/formats/latest.v1.ts";
import { countRules, type CountRules } from "./count-event.ts";

/** How long a pointer read is trusted: the pointer's own `max-age` at the library's address. */
export const POINTER_TTL_MS = 300_000;

/** Where the rules come from: the library's pointer, and the rules of the pool it names. */
export interface RulesUpstream {
  pointer: () => Promise<Latest>;
  rules: (pointer: Latest) => Promise<CountRules>;
}

/** The library at its address, through `get` (the Worker's fetch). */
export function libraryUpstream(get: (url: string) => Promise<Response>): RulesUpstream {
  return { pointer: () => fetchPointer(get), rules: async (pointer) => countRules(await loadReleases(get, pointer)) };
}

/**
 * The rules of the pool the pointer names. The pointer is asked at most every `POINTER_TTL_MS`,
 * whether the last try succeeded or not, and requests arriving during a try share it, so no request
 * pays for the releases' parse more than once in that time, even while a pool cannot be read; the
 * releases are read only when the pointer names others than the rules were made from. While the
 * library cannot be read, the last rules had are used, so an event can still be checked; with none,
 * the answer is null.
 */
export function keptRules(upstream: RulesUpstream, now: () => number): () => Promise<CountRules | null> {
  let kept: { rules: CountRules; key: string } | null = null;
  let tried = Number.NEGATIVE_INFINITY;
  let trying: Promise<CountRules | null> | null = null;
  const tryNow = async (): Promise<CountRules | null> => {
    tried = now();
    try {
      const pointer = await upstream.pointer();
      const key = poolKey(pointer);
      if (kept === null || kept.key !== key) kept = { rules: await upstream.rules(pointer), key };
    } catch {
      // The last rules had stay in use; the next try is after POINTER_TTL_MS.
    }
    return kept?.rules ?? null;
  };
  return () => {
    if (trying !== null) return trying;
    if (now() - tried < POINTER_TTL_MS) return Promise.resolve(kept?.rules ?? null);
    trying = tryNow().finally(() => {
      trying = null;
    });
    return trying;
  };
}
