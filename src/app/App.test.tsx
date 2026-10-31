/** The placeholder page in a simulated DOM (happy-dom). No layout: how it looks is checked in a browser. */

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

/** Renders the page with `load` and lets its promise settle. */
async function page(load: () => Promise<typeof DATA>): Promise<string> {
  await act(() => render(<App load={load} />, root));
  await act(async () => {});
  return root.textContent ?? "";
}

describe("App", () => {
  test("shows how many entries the skill card file holds", async () => {
    const text = await page(() => Promise.resolve(DATA));
    expect(text).toContain("スキルカード 361 件");
    expect(text).not.toContain("読み込めませんでした");
  });

  test("says the data could not be read when the loader refuses, and logs why", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const text = await page(() => Promise.reject(new SkillCardDataError("cards[0].plan: expected sense | logic | anomaly | free")));
      expect(text).toContain("カードデータを読み込めませんでした");
      expect(text).not.toContain("スキルカード");
      expect(String(logged.mock.calls[0]?.[0])).toContain("cards[0].plan");
    } finally {
      logged.mockRestore();
    }
  });

  test("shows neither while the file is still loading", async () => {
    const text = await page(() => new Promise(() => {}));
    expect(text).toBe("学マス　メモリーメモ帳");
  });
});
