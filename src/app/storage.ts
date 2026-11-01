/**
 * The memo and the settings kept in the browser (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 5,
 * D16 and D57): read once at start, written after every change, a burst of changes being one write.
 * The store is passed in (IndexedDB in the page, src/app/idb.ts; a Map in tests), so these rules run
 * under `bun test`. A saved memo goes through the 引き継ぎコード's reader (src/memo/read.ts), so the
 * page never starts from part of one; one it cannot read is copied aside, never written over.
 */

import { isFields } from "../lib/read.ts";
import { memoSize } from "../memo/coverage.ts";
import { MemoFormatError, readMemo } from "../memo/read.ts";
import { emptyMemo, type Memo } from "../memo/types.ts";

/** The slice of a key-value store the page needs. */
export interface Store {
  /** The value under `key`, or undefined when there is none. */
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

export const MEMO_KEY = "memo";
export const SETTINGS_KEY = "settings";
/** A saved memo the reader refuses is copied under this prefix and the time it was found (D57). */
export const UNREADABLE_PREFIX = "unreadable-";

export interface Settings {
  /** The idol of 「カードの絵柄」 (D20), or null for the default, the data file's first idol (D34). */
  idol: string | null;
  /** The counting switch (D12): on unless the player switched it off. */
  counting: boolean;
}

export const DEFAULT_SETTINGS: Settings = { idol: null, counting: true };

/** What the page tells the player about saving: nothing can be saved, a saved memo could not be read, or a write failed. */
export type Notice = "unavailable" | "unreadable" | "save-failed";

export interface Saved {
  memo: Memo;
  settings: Settings;
  notice: Notice | null;
}

/** The saved settings, field by field: a missing or malformed field takes its default, since a setting is cheap to choose again. */
export function readSettings(value: unknown): Settings {
  if (!isFields(value)) return DEFAULT_SETTINGS;
  const idol = value["idol"];
  const counting = value["counting"];
  return { idol: typeof idol === "string" ? idol : null, counting: typeof counting === "boolean" ? counting : DEFAULT_SETTINGS.counting };
}

/**
 * What the store holds: an empty memo when nothing was saved, and the default settings where none
 * were. A memo the reader refuses is copied under `unreadable-<time>` before the page starts empty,
 * so the next save cannot lose it; if that copy cannot be written, this rejects and nothing is saved.
 */
export async function readSaved(store: Store, now: () => Date): Promise<Saved> {
  const [memo, settings] = await Promise.all([store.get(MEMO_KEY), store.get(SETTINGS_KEY)]);
  const read = readSettings(settings);
  if (memo === undefined) return { memo: emptyMemo(), settings: read, notice: null };
  try {
    return { memo: readMemo(memo), settings: read, notice: null };
  } catch (error) {
    if (!(error instanceof MemoFormatError)) throw error;
    console.error("the saved memo was not read:", error);
    await store.put(`${UNREADABLE_PREFIX}${now().toISOString()}`, memo);
    return { memo: emptyMemo(), settings: read, notice: "unreadable" };
  }
}

/** The page's own timer, passed in so a test can run it by hand: `set` runs `run` after `ms` and returns what cancels it. */
export interface Timers {
  set(run: () => void, ms: number): () => void;
}

const GLOBAL_TIMERS: Timers = {
  set: (run, ms) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  },
};

/** The slice of `navigator.storage` that asks the browser to keep the page's storage. */
export interface PersistentStorage {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
}

export interface SavingOptions {
  /** How long the memo waits after a change for the next one before it is written. */
  delayMs: number;
  /** A write failed: the page says so (Notice "save-failed"). */
  onError: (error: unknown) => void;
  /** `navigator.storage`, where the browser has it. */
  storage?: PersistentStorage;
  timers?: Timers;
}

export interface Saving {
  /** Writes the memo once no other change follows within the delay. */
  memo(memo: Memo): void;
  /** Writes the settings at once: they change one tap at a time. */
  settings(settings: Settings): void;
  /** Writes a memo still waiting, at once; when the page is hidden, since a phone may then close it. */
  flush(): Promise<void>;
}

/** How long the memo waits for the next change (D57): a few taps in a row are one write. */
export const SAVE_DELAY_MS = 500;

/**
 * Saving into `store`. The first memo written with a row in it asks the browser, once, to keep the
 * storage (`persist()`, D57): Firefox asks the player, and an empty memo is nothing to ask for.
 */
export function saving(store: Store, options: SavingOptions): Saving {
  const timers = options.timers ?? GLOBAL_TIMERS;
  let waiting: Memo | null = null;
  let cancel: (() => void) | null = null;
  let asked = false;
  const askToKeep = async (memo: Memo): Promise<void> => {
    if (asked || options.storage === undefined || memoSize(memo).rows === 0) return;
    asked = true;
    if (!(await options.storage.persisted())) await options.storage.persist();
  };
  const write = async (): Promise<void> => {
    cancel = null;
    const memo = waiting;
    waiting = null;
    if (memo === null) return;
    try {
      await store.put(MEMO_KEY, memo);
    } catch (error) {
      options.onError(error);
      return;
    }
    // Whether the browser keeps the storage is its own call; a refusal or an error changes nothing here.
    await askToKeep(memo).catch(() => undefined);
  };
  return {
    memo(memo) {
      waiting = memo;
      cancel?.();
      cancel = timers.set(() => void write(), options.delayMs);
    },
    settings(settings) {
      store.put(SETTINGS_KEY, settings).catch(options.onError);
    },
    flush() {
      cancel?.();
      return write();
    },
  };
}

/** Saving nowhere, where the browser has no storage for the page: the page still works, and says so (Notice "unavailable"). */
export const NOT_SAVING: Saving = { memo: () => undefined, settings: () => undefined, flush: () => Promise.resolve() };
