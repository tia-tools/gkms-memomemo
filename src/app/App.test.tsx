/** The page's loading and saving in a simulated DOM (happy-dom). No layout: how it looks is checked in a browser. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { parseSkillCardData, SkillCardDataError } from "../data/load.ts";
import { addRowThroughPopover, byText, CATALOG, must, section } from "../test-support/page.tsx";
import { type MemoryStore, memoryStore } from "../test-support/store.ts";
import type { CountEvent } from "../../infra/worker/count-contract.ts";
import { App, NOTICE_TEXT } from "./App.tsx";
import type { CountsApi } from "./counts.ts";
import { MEMO_KEY, SETTINGS_KEY, type Store, UNREADABLE_PREFIX } from "./storage.ts";

const DATA = parseSkillCardData(JSON.parse(await Bun.file(new URL("../data/fixtures/skillcards.v1.json", import.meta.url)).text()));
const HIF_CARD = must(CATALOG.tabAbilities("sense")[0], "a センス ability").card.name;

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

/** Renders the page with the loader and the store, and lets their promises settle. */
async function page(load: () => Promise<typeof DATA>, openStore: () => Promise<Store> = () => Promise.resolve(memoryStore())): Promise<string> {
  await act(() => render(<App load={load} openStore={openStore} />, root));
  // The card file and the saved memo settle over several turns; a timer's turn comes after them all.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return root.textContent ?? "";
}

/** The page closed and opened again on the same store, after a memo waiting to be written is flushed as a phone leaving the page would. */
async function reopen(store: MemoryStore): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
  });
  await act(() => render(null, root));
  await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
}

const rowNames = (label: string) => [...section(root, label).querySelectorAll("[data-row]")].map((el) => el.querySelector('[role="img"]')?.getAttribute("aria-label"));

describe("App", () => {
  test("shows the three tabs and the センス tab's sections once the skill card file has loaded", async () => {
    const text = await page(() => Promise.resolve(DATA));
    const tabs = [...root.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(["センス", "ロジック", "アノマリー"]);
    expect([...root.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["好調", "集中", "共通"]);
    expect(text).not.toContain("読み込めませんでした");
  });

  test("switching tabs shows that plan's sections", async () => {
    await page(() => Promise.resolve(DATA));
    await act(() => [...root.querySelectorAll<HTMLElement>('[role="tab"]')][2]?.click());
    expect([...root.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["強気", "全力", "共通"]);
  });

  test("says the data could not be read when the loader refuses, and logs why", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const text = await page(() => Promise.reject(new SkillCardDataError("cards[0].plan: expected sense | logic | anomaly | free")));
      expect(text).toContain("カードデータを読み込めませんでした");
      expect(root.querySelector('[role="tab"]')).toBeNull();
      expect(String(logged.mock.calls[0]?.[0])).toContain("cards[0].plan");
    } finally {
      logged.mockRestore();
    }
  });

  test("asks only for the skill card file: the icons' index comes with the page", async () => {
    const fetched = spyOn(globalThis, "fetch");
    try {
      await page(() => Promise.resolve(DATA));
      expect(fetched.mock.calls).toEqual([]);
    } finally {
      fetched.mockRestore();
    }
    expect(root.querySelectorAll('[role="tab"]').length).toBe(3);
  });

  test("shows only the title while the file is still loading", async () => {
    const text = await page(() => new Promise(() => {}));
    expect(text).toBe("学マス　メモリーメモ帳");
  });

  test("waits for the saved memo too", async () => {
    const text = await page(
      () => Promise.resolve(DATA),
      () => new Promise(() => {}),
    );
    expect(text).toBe("学マス　メモリーメモ帳");
  });
});

describe("saving (Milestone 5, D57)", () => {
  test("a row added is there after the page is opened again", async () => {
    const store = memoryStore();
    await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    await addRowThroughPopover(root, "好調", "成就+", HIF_CARD);
    await reopen(store);
    expect(rowNames("好調")).toEqual(["成就+"]);
  });

  test("a memo waiting is written when the page is hidden", async () => {
    const store = memoryStore();
    await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    await addRowThroughPopover(root, "好調", "成就+", HIF_CARD);
    expect(store.writes).toEqual([]);
    const fire = (state: string) =>
      act(async () => {
        // happy-dom's document is always visible; an own property shadows its getter for the test.
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    try {
      await fire("visible");
      expect(store.writes).toEqual([]);
      await fire("hidden");
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
    expect(store.writes).toEqual([MEMO_KEY]);
  });

  test("opening the page writes nothing: only a change is saved", async () => {
    const store = memoryStore();
    await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(store.writes).toEqual([]);
  });

  test("「カードの絵柄」 and the counting switch are kept", async () => {
    const store = memoryStore();
    await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    const select = must(root.querySelector("select"), "カードの絵柄");
    await act(() => {
      select.value = "ttmr";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(() => byText(root, "label", "集計に協力する").querySelector("input")?.click());
    await reopen(store);
    expect(store.kept.get(SETTINGS_KEY)).toEqual({ idol: "ttmr", counting: false });
    expect(must(root.querySelector("select"), "カードの絵柄").value).toBe("ttmr");
    expect(byText(root, "label", "集計に協力する").querySelector("input")?.checked).toBe(false);
  });

  test("a saved idol the data file no longer has gives the first idol", async () => {
    const store = memoryStore({ [SETTINGS_KEY]: { idol: "zzzz", counting: true } });
    await page(
      () => Promise.resolve(DATA),
      () => Promise.resolve(store),
    );
    expect(must(root.querySelector("select"), "カードの絵柄").value).toBe("hski");
    // A select shows its first option for a value it lacks, so the idol is read where it is saved.
    await act(() => byText(root, "label", "集計に協力する").querySelector("input")?.click());
    expect(store.kept.get(SETTINGS_KEY)).toEqual({ idol: "hski", counting: false });
  });

  test("where nothing can be saved, the page still works and says so", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const text = await page(
      () => Promise.resolve(DATA),
      () => Promise.reject(new Error("no IndexedDB")),
    );
    logged.mockRestore();
    expect(text).toContain(NOTICE_TEXT.unavailable);
    await addRowThroughPopover(root, "好調", "成就+", HIF_CARD);
    expect(rowNames("好調")).toEqual(["成就+"]);
  });

  test("a saved memo that cannot be read is kept aside, and the page says so", async () => {
    const store = memoryStore({ [MEMO_KEY]: { formatVersion: 9 } });
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const text = await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    logged.mockRestore();
    expect(text).toContain(NOTICE_TEXT.unreadable);
    expect([...store.kept.keys()].filter((key) => key.startsWith(UNREADABLE_PREFIX)).length).toBe(1);
  });

  test("a write that fails is said on the page", async () => {
    const store = memoryStore();
    await page(() => Promise.resolve(DATA), () => Promise.resolve(store));
    expect(root.textContent).not.toContain(NOTICE_TEXT["save-failed"]);
    store.failWith = new Error("quota");
    const logged = spyOn(console, "error").mockImplementation(() => {});
    await addRowThroughPopover(root, "好調", "成就+", HIF_CARD);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    logged.mockRestore();
    expect(root.textContent).toContain(NOTICE_TEXT["save-failed"]);
  });
});

describe("App's counts", () => {
  test("loads the counts once and sends a new row's event through the counts it is given (Milestone 6)", async () => {
    let loads = 0;
    const sent: CountEvent[] = [];
    const countsApi: CountsApi = { load: async () => (loads++, null), send: (event) => void sent.push(event) };
    await act(() => render(<App load={() => Promise.resolve(DATA)} openStore={() => Promise.resolve(memoryStore())} countsApi={countsApi} />, root));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await addRowThroughPopover(root, "好調", "成就+", HIF_CARD);
    expect(loads).toBe(1);
    expect(sent.map((e) => [e.section, e.card])).toEqual([["sense.kocho", must(DATA.cards.find((c) => c.name === "成就+"), "成就+").id]]);
  });
});
