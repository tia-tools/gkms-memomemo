/** The page's loading in a simulated DOM (happy-dom). No layout: how it looks is checked in a browser. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { parseSkillCardData, SkillCardDataError } from "../data/load.ts";
import { App } from "./App.tsx";

const DATA = parseSkillCardData(JSON.parse(await Bun.file(new URL("../data/fixtures/skillcards.v1.json", import.meta.url)).text()));

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

/** Renders the page with the loader and lets its promise settle. */
async function page(load: () => Promise<typeof DATA>): Promise<string> {
  await act(() => render(<App load={load} />, root));
  await act(async () => {});
  return root.textContent ?? "";
}

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
});
