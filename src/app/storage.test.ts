import { describe, expect, spyOn, test } from "bun:test";
import { emptyMemo, emptyRow, type Memo } from "../memo/types.ts";
import { manualTimers, memoryStore } from "../test-support/store.ts";
import { DEFAULT_SETTINGS, MEMO_KEY, readSaved, readSettings, saving, SETTINGS_KEY, type PersistentStorage, UNREADABLE_PREFIX } from "./storage.ts";

const NOW = () => new Date("2026-11-01T12:00:00.000Z");

function withRow(id = "r1"): Memo {
  const row = emptyRow(id, { card: "p_card-01-act-3_029", upgrade: 1, customization: [], kaimaku: false, hif: "memory_ability-x" });
  return { ...emptyMemo(), sections: { ...emptyMemo().sections, "sense.kocho": [row] } };
}

describe("readSettings", () => {
  test("reads a saved idol and counting switch", () => {
    expect(readSettings({ idol: "ttmr", counting: false })).toEqual({ idol: "ttmr", counting: false });
  });

  test("nothing saved, or not an object, is the default: the first idol and counting on", () => {
    for (const value of [undefined, null, "ttmr", [], 3]) expect(readSettings(value)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ idol: null, counting: true });
  });

  test("a malformed field takes its default and leaves the other as saved", () => {
    expect(readSettings({ idol: 7, counting: false })).toEqual({ idol: null, counting: false });
    expect(readSettings({ idol: "ttmr", counting: "no" })).toEqual({ idol: "ttmr", counting: true });
  });
});

describe("readSaved", () => {
  test("an empty store is an empty memo with the default settings, and nothing is written", async () => {
    const store = memoryStore();
    expect(await readSaved(store, NOW)).toEqual({ memo: emptyMemo(), settings: DEFAULT_SETTINGS, notice: null });
    expect(store.writes).toEqual([]);
  });

  test("reads back the memo and the settings saved", async () => {
    const store = memoryStore({ [MEMO_KEY]: withRow(), [SETTINGS_KEY]: { idol: "ttmr", counting: false } });
    expect(await readSaved(store, NOW)).toEqual({ memo: withRow(), settings: { idol: "ttmr", counting: false }, notice: null });
  });

  test("a memo the reader refuses is copied aside under the time, and the page starts empty and says so", async () => {
    const broken = { ...withRow(), formatVersion: 2 };
    const store = memoryStore({ [MEMO_KEY]: broken, [SETTINGS_KEY]: { idol: "ttmr", counting: true } });
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await readSaved(store, NOW)).toEqual({ memo: emptyMemo(), settings: { idol: "ttmr", counting: true }, notice: "unreadable" });
    } finally {
      logged.mockRestore();
    }
    expect(store.kept.get(`${UNREADABLE_PREFIX}2026-11-01T12:00:00.000Z`)).toEqual(broken);
    // The original stays until the player's next change is saved over it.
    expect(store.kept.get(MEMO_KEY)).toEqual(broken);
  });

  test("when the unreadable memo cannot be copied aside, reading fails, so nothing can be saved over it", async () => {
    const store = memoryStore({ [MEMO_KEY]: { formatVersion: 1 } });
    store.failWith = new Error("quota");
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const failed = await readSaved(store, NOW).then(
      () => null,
      (error: unknown) => error,
    );
    logged.mockRestore();
    expect(failed).toBe(store.failWith);
  });
});

const noError = (error: unknown) => {
  throw error;
};

describe("saving the memo", () => {
  test("a burst of changes is one write, of the last memo, once the delay passes", async () => {
    const store = memoryStore();
    const timers = manualTimers();
    const save = saving(store, { delayMs: 500, onError: noError, timers });
    save.memo(emptyMemo());
    save.memo(withRow("a"));
    save.memo(withRow("b"));
    expect([store.writes, timers.pending()]).toEqual([[], 1]);
    timers.runAll();
    await save.flush();
    expect(store.writes).toEqual([MEMO_KEY]);
    expect(store.kept.get(MEMO_KEY)).toEqual(withRow("b"));
  });

  test("flush writes a waiting memo at once, and the cancelled timer writes nothing more", async () => {
    const store = memoryStore();
    const timers = manualTimers();
    const save = saving(store, { delayMs: 500, onError: noError, timers });
    save.memo(withRow());
    await save.flush();
    expect([store.writes, timers.pending()]).toEqual([[MEMO_KEY], 0]);
  });

  test("flush with nothing waiting writes nothing", async () => {
    const store = memoryStore();
    await saving(store, { delayMs: 500, onError: noError, timers: manualTimers() }).flush();
    expect(store.writes).toEqual([]);
  });

  test("a failed write is reported, not thrown", async () => {
    const store = memoryStore();
    store.failWith = new Error("quota");
    const errors: unknown[] = [];
    const save = saving(store, { delayMs: 500, onError: (e) => errors.push(e), timers: manualTimers() });
    save.memo(withRow());
    await save.flush();
    expect(errors).toEqual([store.failWith]);
  });
});

/** A `navigator.storage` that records what it was asked. */
function storageAsked(persisted: boolean): PersistentStorage & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    persisted: () => {
      asked.push("persisted");
      return Promise.resolve(persisted);
    },
    persist: () => {
      asked.push("persist");
      return Promise.resolve(true);
    },
  };
}

describe("asking the browser to keep the storage (D57)", () => {
  test("is asked once, after the first memo with a row is written", async () => {
    const storage = storageAsked(false);
    const save = saving(memoryStore(), { delayMs: 0, onError: noError, storage, timers: manualTimers() });
    save.memo(emptyMemo());
    await save.flush();
    expect(storage.asked).toEqual([]);
    save.memo(withRow());
    await save.flush();
    save.memo(withRow("b"));
    await save.flush();
    expect(storage.asked).toEqual(["persisted", "persist"]);
  });

  test("is not asked again when the storage is already kept", async () => {
    const storage = storageAsked(true);
    const save = saving(memoryStore(), { delayMs: 0, onError: noError, storage, timers: manualTimers() });
    save.memo(withRow());
    await save.flush();
    expect(storage.asked).toEqual(["persisted"]);
  });

  test("is not asked when the write failed", async () => {
    const storage = storageAsked(false);
    const store = memoryStore();
    store.failWith = new Error("quota");
    const save = saving(store, { delayMs: 0, onError: () => undefined, storage, timers: manualTimers() });
    save.memo(withRow());
    await save.flush();
    expect(storage.asked).toEqual([]);
  });

  test("a browser that rejects the ask leaves saving as it was", async () => {
    const store = memoryStore();
    const storage: PersistentStorage = { persisted: () => Promise.reject(new Error("no")), persist: () => Promise.resolve(false) };
    const save = saving(store, { delayMs: 0, onError: noError, storage, timers: manualTimers() });
    save.memo(withRow());
    await save.flush();
    save.memo(withRow("b"));
    await save.flush();
    expect(store.writes).toEqual([MEMO_KEY, MEMO_KEY]);
  });
});

describe("saving the settings", () => {
  test("writes them at once", async () => {
    const store = memoryStore();
    saving(store, { delayMs: 500, onError: noError, timers: manualTimers() }).settings({ idol: "ttmr", counting: false });
    await Promise.resolve();
    expect(store.kept.get(SETTINGS_KEY)).toEqual({ idol: "ttmr", counting: false });
  });

  test("a failed write is reported", async () => {
    const store = memoryStore();
    store.failWith = new Error("quota");
    const errors: unknown[] = [];
    saving(store, { delayMs: 500, onError: (e) => errors.push(e), timers: manualTimers() }).settings(DEFAULT_SETTINGS);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).toEqual([store.failWith]);
  });
});
