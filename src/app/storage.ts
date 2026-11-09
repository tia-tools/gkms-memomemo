/**
 * The memo and the settings kept in the browser (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 5,
 * D16 and D57): read once at start, written after every change, a burst of changes being one write.
 * The store is passed in (IndexedDB in the page, src/app/idb.ts; a Map in tests), so these rules run
 * under `bun test`. A saved memo goes through the 引き継ぎコード's reader (src/memo/read.ts), so the
 * page never starts from part of one; one it cannot read is copied aside, never written over. With
 * the page open in two tabs, each says on a channel when it wrote (src/app/tabs.ts), and the other
 * reads the store again, so neither saves an older memo over the other's (#29).
 */

import { isFields } from "../lib/read.ts";
import { memoSize } from "../memo/coverage.ts";
import { MemoFormatError, readMemo } from "../memo/read.ts";
import { emptyMemo, type Memo } from "../memo/types.ts";
import { NO_TABS, type TabChannel } from "./tabs.ts";

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

/** What the store held under each key as this tab last read or wrote it, as JSON; null for nothing. */
export interface Seen {
  memo: string | null;
  settings: string | null;
}

export const SEEN_NOTHING: Seen = { memo: null, settings: null };

const asJson = (value: unknown): string | null => (value === undefined ? null : JSON.stringify(value));

export interface Saved {
  memo: Memo;
  settings: Settings;
  notice: Notice | null;
  /** What the store held, so that a later reread tells another tab's write from what was read here (#29). */
  seen: Seen;
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
  const seen: Seen = { memo: asJson(memo), settings: asJson(settings) };
  if (memo === undefined) return { memo: emptyMemo(), settings: read, notice: null, seen };
  try {
    return { memo: readMemo(memo), settings: read, notice: null, seen };
  } catch (error) {
    if (!(error instanceof MemoFormatError)) throw error;
    console.error("the saved memo was not read:", error);
    await store.put(`${UNREADABLE_PREFIX}${now().toISOString()}`, memo);
    return { memo: emptyMemo(), settings: read, notice: "unreadable", seen };
  }
}

/**
 * What the page starts from: the saved state and the store to save into. Where the store cannot be
 * opened or read (no IndexedDB, or an unreadable memo that could not be copied aside), an empty memo
 * and no store, so nothing is written over what is there, and the notice "unavailable".
 */
export async function openSaved(openStore: () => Promise<Store>, now: () => Date): Promise<{ saved: Saved; store: Store | null }> {
  try {
    const store = await openStore();
    return { saved: await readSaved(store, now), store };
  } catch (error) {
    console.error("the memo cannot be saved here:", error);
    return { saved: { memo: emptyMemo(), settings: DEFAULT_SETTINGS, notice: "unavailable", seen: SEEN_NOTHING }, store: null };
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
  /** What the store held when the page read it (`Saved.seen`); nothing, when not given. */
  seen?: Seen;
  /** The page's other tabs: told after each write, and heard when they write (#29). */
  channel?: TabChannel;
}

/** What another tab saved that this one has not seen; a key is missing where there is nothing new to take. */
export interface Reread {
  memo?: Memo;
  settings?: Settings;
}

export interface Saving {
  /** Writes the memo once no other change follows within the delay. */
  memo: (memo: Memo) => void;
  /** Writes the settings at once: they change one tap at a time. */
  settings: (settings: Settings) => void;
  /** Writes a memo still waiting, at once; when the page is hidden, since a phone may then close it. */
  flush: () => Promise<void>;
  /**
   * Reads the store again, for what another tab saved since this one last read or wrote it (#29).
   * A memo or settings this tab is still writing, or began writing while the store was read, is not
   * taken: this tab's change goes over it, and the other tab then takes that. A memo the reader
   * refuses (a later version of the page wrote it) is not taken either, and is logged.
   */
  reread: () => Promise<Reread>;
  /** Calls `heard` whenever another tab says it wrote the store; returns what stops listening. */
  listen: (heard: () => void) => () => void;
}

/** How long the memo waits for the next change (D57): a few taps in a row are one write. */
export const SAVE_DELAY_MS = 500;

/** Asks the browser, once, to keep the storage, after the first memo with a row in it is written (D57). */
function keeper(storage: PersistentStorage | undefined): (memo: Memo) => Promise<void> {
  let asked = false;
  return async (memo) => {
    if (asked || storage === undefined || memoSize(memo).rows === 0) return;
    asked = true;
    if (!(await storage.persisted())) await storage.persist();
  };
}

/** Where each key's writes stand: a change counts when it is made, and `flying` while its write is unfinished. */
interface Writes {
  changes: number;
  flying: number;
}

/** The memo another tab saved, when it is new to `seen` and this page can read it; `seen` then holds it. */
function takeMemo(stored: unknown, seen: Seen): Memo | undefined {
  const json = asJson(stored);
  if (json === null || json === seen.memo) return undefined;
  seen.memo = json;
  try {
    return readMemo(stored);
  } catch (error) {
    if (!(error instanceof MemoFormatError)) throw error;
    console.error("another tab saved a memo this page cannot read:", error);
    return undefined;
  }
}

/** The settings another tab saved, when they are new to `seen`; `seen` then holds them. */
function takeSettings(stored: unknown, seen: Seen): Settings | undefined {
  const json = asJson(stored);
  if (json === null || json === seen.settings) return undefined;
  seen.settings = json;
  return readSettings(stored);
}

/** The store read again for what another tab saved (`Saving.reread`); a key with a change of this tab's under way is left out. */
async function reread(store: Store, seen: Seen, memo: Writes, settings: Writes, memoWaiting: () => boolean): Promise<Reread> {
  const before = { memo: memo.changes, settings: settings.changes };
  const [storedMemo, storedSettings] = await Promise.all([store.get(MEMO_KEY), store.get(SETTINGS_KEY)]);
  const found: Reread = {};
  if (!memoWaiting() && memo.flying === 0 && memo.changes === before.memo) {
    const taken = takeMemo(storedMemo, seen);
    if (taken !== undefined) found.memo = taken;
  }
  if (settings.flying === 0 && settings.changes === before.settings) {
    const taken = takeSettings(storedSettings, seen);
    if (taken !== undefined) found.settings = taken;
  }
  return found;
}

/**
 * Saving into `store`. The first memo written with a row in it asks the browser, once, to keep the
 * storage (`persist()`, D57): Firefox asks the player, and an empty memo is nothing to ask for.
 * After each write the page's other tabs are told (#29).
 */
export function saving(store: Store, options: SavingOptions): Saving {
  const timers = options.timers ?? GLOBAL_TIMERS;
  const channel = options.channel ?? NO_TABS;
  const seen: Seen = { ...(options.seen ?? SEEN_NOTHING) };
  const memoWrites: Writes = { changes: 0, flying: 0 };
  const settingsWrites: Writes = { changes: 0, flying: 0 };
  const askToKeep = keeper(options.storage);
  let waiting: Memo | null = null;
  let cancel: (() => void) | null = null;
  const write = async (): Promise<void> => {
    cancel = null;
    const memo = waiting;
    waiting = null;
    if (memo === null) return;
    memoWrites.flying += 1;
    try {
      await store.put(MEMO_KEY, memo);
    } catch (error) {
      options.onError(error);
      return;
    } finally {
      memoWrites.flying -= 1;
    }
    seen.memo = JSON.stringify(memo);
    channel.post();
    // Whether the browser keeps the storage is its own call; a refusal or an error changes nothing here.
    await askToKeep(memo).catch(() => undefined);
  };
  return {
    memo: (memo) => {
      memoWrites.changes += 1;
      waiting = memo;
      cancel?.();
      cancel = timers.set(() => void write(), options.delayMs);
    },
    settings: (settings) => {
      settingsWrites.changes += 1;
      settingsWrites.flying += 1;
      store
        .put(SETTINGS_KEY, settings)
        .then(() => {
          seen.settings = JSON.stringify(settings);
          channel.post();
        }, options.onError)
        .finally(() => {
          settingsWrites.flying -= 1;
        });
    },
    flush: () => {
      cancel?.();
      return write();
    },
    reread: () => reread(store, seen, memoWrites, settingsWrites, () => waiting !== null),
    listen: (heard) => channel.listen(heard),
  };
}

/** Saving nowhere, where the browser has no storage for the page: the page still works, and says so (Notice "unavailable"). */
export const NOT_SAVING: Saving = {
  memo: () => undefined,
  settings: () => undefined,
  flush: () => Promise.resolve(),
  reread: () => Promise.resolve({}),
  listen: () => () => undefined,
};
