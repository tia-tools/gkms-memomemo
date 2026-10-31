/** The page's loading in a simulated DOM (happy-dom). No layout: how it looks is checked in a browser. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { parseSkillCardData, SkillCardDataError } from "../data/load.ts";
import { App } from "./App.tsx";
import { NO_SHEETS, type SheetIndex, SheetIndexError } from "./sheets.ts";

const DATA = parseSkillCardData(JSON.parse(await Bun.file(new URL("../data/fixtures/skillcards.v1.json", import.meta.url)).text()));
const noSheets = () => Promise.resolve(NO_SHEETS);

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

/** Renders the page with the two loaders and lets their promises settle. */
async function page(load: () => Promise<typeof DATA>, loadSheets: () => Promise<SheetIndex> = noSheets): Promise<string> {
  await act(() => render(<App load={load} loadSheets={loadSheets} />, root));
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

  test("still shows the memo when the sprite sheet index cannot be had, and says why in the console", async () => {
    const warned = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await page(
        () => Promise.resolve(DATA),
        () => Promise.reject(new SheetIndexError("/img/sheet112/index.v1.json: HTTP 404")),
      );
      expect(root.querySelectorAll('[role="tab"]').length).toBe(3);
      expect(String(warned.mock.calls[0]?.[1])).toContain("HTTP 404");
    } finally {
      warned.mockRestore();
    }
  });

  test("shows only the title while the file is still loading", async () => {
    const text = await page(() => new Promise(() => {}));
    expect(text).toBe("学マス　メモリーメモ帳");
  });
});
