/**
 * Stand-ins for the browser's storage in tests (src/app/storage.ts): a store over a Map, which
 * structured-clones what it keeps as IndexedDB does, and timers that run only when the test says.
 */

import type { Store, Timers } from "../app/storage.ts";

export interface MemoryStore extends Store {
  /** What the store holds, by key. */
  readonly kept: Map<string, unknown>;
  /** Every key written, in order. */
  readonly writes: string[];
  /** When set, every put rejects with this error. */
  failWith: Error | null;
}

export function memoryStore(initial: Record<string, unknown> = {}): MemoryStore {
  const kept = new Map<string, unknown>(Object.entries(initial));
  const store: MemoryStore = {
    kept,
    writes: [],
    failWith: null,
    get: (key) => Promise.resolve(kept.has(key) ? structuredClone(kept.get(key)) : undefined),
    put: (key, value) => {
      if (store.failWith !== null) return Promise.reject(store.failWith);
      store.writes.push(key);
      kept.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
  return store;
}

export interface ManualTimers extends Timers {
  /** How many timers are set and neither run nor cancelled. */
  pending(): number;
  /** Runs every pending timer, whatever its delay. */
  runAll(): void;
}

export function manualTimers(): ManualTimers {
  const waiting = new Set<() => void>();
  return {
    set: (run) => {
      const entry = () => run();
      waiting.add(entry);
      return () => waiting.delete(entry);
    },
    pending: () => waiting.size,
    runAll: () => {
      const runs = [...waiting];
      waiting.clear();
      for (const run of runs) run();
    },
  };
}
