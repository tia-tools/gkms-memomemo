/** The memo page's parts in a simulated DOM (happy-dom). No layout: how it looks is checked in a browser. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { newBuild } from "../memo/build.ts";
import { addMemory, addRow, isRefusal, type Edited } from "../memo/edit.ts";
import { emptyMemo, type Memo, type Memory } from "../memo/types.ts";
import { cardNamed, kindLabelled } from "../test-support/skillcards.ts";
import { addRowThroughPopover, byLabel, byText, CATALOG, dialog, must, pick, section, showPage, tap, type } from "../test-support/page.tsx";

const HIF = must(CATALOG.tabAbilities("sense")[0], "a センス ability");
const DDR: Memory = ["diamond", "diamond", "rainbow"];

function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

/** A memo with 成就+ in 好調 holding one %%F memory, as row r1. */
function withJoju(): Memo {
  const card = cardNamed("成就+");
  return addMemory(ok(addRow(emptyMemo(), "sense.kocho", "r1", newBuild(card.id, card, HIF.ability.id))), "r1", "%%F", DDR);
}

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

const STAT_NAMES = ["Vo", "Da", "Vi"] as const;

/** Chooses tiers in the open memory popover, Vo, Da, Vi in order, by the buttons' accessible names. */
async function chooseTiers(tiers: readonly ("ダイヤ" | "虹")[]): Promise<void> {
  for (const [i, tier] of tiers.entries()) {
    const name = `${STAT_NAMES[i] ?? ""} ${tier}`;
    await tap(must(dialog(root).querySelector<HTMLElement>(`button[aria-label^="${name} "]`), name));
  }
}

describe("the Purpose scenario", () => {
  test("a row 成就+ in 好調 with a %%F memory shows 3.5 / 3.5 / 20, the other fixed groups 未所持, and the 早見表 one ✓", async () => {
    await showPage(root);
    await addRowThroughPopover(root, "好調", "成就+", HIF.card.name);
    const kocho = section(root, "好調");
    expect(kocho.textContent).toContain("成就+");
    await tap(byLabel(kocho, "%%F 未所持"));
    const shown = [...dialog(root).querySelectorAll("button[aria-pressed]")].map((b) => b.textContent);
    expect(shown).toEqual(["3.5", "2.8", "3.5", "2.8", "25", "20"]);
    await chooseTiers(["ダイヤ", "ダイヤ", "虹"]);
    await tap(byText(dialog(root), "button", "追加"));
    expect(byLabel(kocho, "%%F 3.5 / 3.5 / 20").textContent).toBe("3.53.520");
    expect(kocho.querySelector('[aria-label="%%F 未所持"]')).toBeNull();
    expect(byLabel(kocho, "%F% 未所持")).toBeTruthy();
    expect(byLabel(kocho, "F%% 未所持")).toBeTruthy();
    const table = must(root.querySelector("details"), "the 早見表");
    expect(table.textContent).toContain("✓");
    expect(table.querySelectorAll('[aria-label="未所持"]').length).toBe(2);
  });
});

describe("the memory popover", () => {
  test("追加 stays disabled until all three tiers are chosen", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "%F% 未所持"));
    const add = byText(dialog(root), "button", "追加");
    expect(add.hasAttribute("disabled")).toBe(true);
    await chooseTiers(["ダイヤ", "虹"]);
    expect(add.hasAttribute("disabled")).toBe(true);
    await chooseTiers(["ダイヤ", "虹", "虹"]);
    expect(add.hasAttribute("disabled")).toBe(false);
  });

  test("a second memory of a pattern stacks under the first, through the ＋ strip", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "%%Fをもう1件追加"));
    await chooseTiers(["虹", "虹", "虹"]);
    await tap(byText(dialog(root), "button", "追加"));
    const lines = [...section(root, "好調").querySelectorAll('[aria-label^="%%F "]')].map((el) => el.getAttribute("aria-label"));
    expect(lines).toEqual(["%%F 3.5 / 3.5 / 20", "%%F 2.8 / 2.8 / 20"]);
  });

  test("an owned line opens with its tiers chosen, and 変更 changes it in place", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "%%F 3.5 / 3.5 / 20"));
    const pressed = [...dialog(root).querySelectorAll('button[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label"));
    expect(pressed).toEqual(["Vo ダイヤ 3.5", "Da ダイヤ 3.5", "Vi 虹 20"]);
    await chooseTiers(["虹"]);
    await tap(byText(dialog(root), "button", "変更"));
    const lines = [...section(root, "好調").querySelectorAll('[aria-label^="%%F "]')].map((el) => el.getAttribute("aria-label"));
    expect(lines).toEqual(["%%F 2.8 / 3.5 / 20"]);
  });

  test("deleting a memory takes two taps: the first arms it, the second deletes", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "%%F 3.5 / 3.5 / 20"));
    await tap(byText(dialog(root), "button", "削除"));
    expect(byText(dialog(root), "button", "もう一度押すと削除").className).toContain("armed");
    expect(byLabel(section(root, "好調"), "%%F 3.5 / 3.5 / 20")).toBeTruthy();
    await tap(byText(dialog(root), "button", "もう一度押すと削除"));
    expect(byLabel(section(root, "好調"), "%%F 未所持")).toBeTruthy();
  });
});

describe("the row popover", () => {
  test("refuses a build already in the tab, naming its section, and jumps to its row", async () => {
    await showPage(root, withJoju());
    await addRowThroughPopover(root, "集中", "成就+", HIF.card.name);
    expect(byText(root, '[role="alert"]', "同じ組み合わせが「好調」にありますその行へ")).toBeTruthy();
    expect(section(root, "集中").textContent).not.toContain("成就+");
    await tap(byText(dialog(root), "button", "その行へ"));
    expect(must(document.getElementById("row-r1"), "row r1").className).toContain("highlight");
  });

  test("an SR + card's 開幕時獲得 starts on and is switched off and locked by a customization (D40)", async () => {
    await showPage(root);
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    await tap(must([...dialog(root).querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "前途洋々+"), "前途洋々+"));
    const kaimaku = must(dialog(root).querySelector<HTMLInputElement>('input[type="checkbox"]'), "開幕時獲得");
    expect([kaimaku.checked, kaimaku.disabled]).toEqual([true, false]);
    const step = must([...dialog(root).querySelectorAll<HTMLElement>("button[aria-pressed]")].find((b) => b.textContent?.endsWith(" 1回") === true), "a step");
    await tap(step);
    const after = must(dialog(root).querySelector<HTMLInputElement>('input[type="checkbox"]'), "開幕時獲得");
    expect([after.checked, after.disabled]).toEqual([false, true]);
  });
});

describe("the card step's rarity filter (D56)", () => {
  const shown = () => [...dialog(root).querySelectorAll("button[aria-pressed] span:last-child")].map((el) => el.textContent);
  const offeredNames = (...rarities: string[]) =>
    CATALOG.tabCards("sense")
      .filter((c) => rarities.length === 0 || rarities.includes(c.rarity))
      .map((c) => c.name);
  const toggle = (rarity: string) => tap(byText(byLabel(dialog(root), "レアリティ"), "button", rarity));

  test("shows only the rarities switched on, several at once, and every card again when none is on", async () => {
    await showPage(root);
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    expect(shown()).toEqual(offeredNames());
    await toggle("SSR");
    expect(shown()).toEqual(offeredNames("SSR"));
    expect(shown().length).toBeGreaterThan(0);
    await toggle("R");
    expect(shown()).toEqual(offeredNames("SSR", "R"));
    await toggle("SSR");
    await toggle("R");
    expect(shown()).toEqual(offeredNames());
  });

  test("works with the search: a name and a rarity together", async () => {
    await showPage(root);
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    await type(byLabel(dialog(root), "カード名"), "ファンサ");
    expect(shown()).toEqual(["ファンサ", "ファンサ+"]);
    await toggle("SSR");
    expect(shown()).toEqual([]);
    await toggle("SSR");
    await toggle("R");
    expect(shown()).toEqual(["ファンサ", "ファンサ+"]);
  });

  test("N shows 表現の基本 alone, the one N card that can be a produce memory (D54)", async () => {
    await showPage(root);
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    await toggle("N");
    expect(shown()).toEqual(["表現の基本"]);
  });
});

describe("the row menu", () => {
  test("deleting a row takes two taps and its armed state says how many memories go with it", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "行を削除"));
    expect(section(root, "好調").textContent).toContain("成就+");
    await tap(byText(dialog(root), "button", "メモリー1件も削除"));
    expect(section(root, "好調").textContent).not.toContain("成就+");
  });

  test("moves a row to the end of another section of the tab", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "共通"));
    expect(section(root, "共通").textContent).toContain("成就+");
    expect(section(root, "好調").textContent).not.toContain("成就+");
  });
});

describe("changing a row whose build the rules reject (saved before the data changed)", () => {
  const FANSA = cardNamed("ファンサ+");

  test("is not saved as it is: the customization step opens again, and a valid choice saves", async () => {
    const over = { ...newBuild(FANSA.id, FANSA, HIF.ability.id), customization: [{ kind: kindLabelled(FANSA, "パラメータ+"), step: 3 }] };
    await showPage(root, ok(addRow(emptyMemo(), "sense.kocho", "r1", over)));
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    await tap(byText(dialog(root), "button", "この内容で保存"));
    expect(byText(root, '[role="alert"]', "このカードでは選べない組み合わせです。カスタマイズを選び直してください")).toBeTruthy();
    expect(section(root, "好調").textContent).toContain("パラメータ+ 3回");
    // The 回数 is kept on one line in the card column, however the label wraps (D51).
    expect(must(section(root, "好調").querySelector("span.whitespace-nowrap"), "the 回数").textContent).toBe("3回");
    await tap(byText(dialog(root), "button", "なし"));
    expect(root.querySelector('[role="alert"]')).toBeNull();
    await tap(byText(dialog(root), "button", "この内容で保存"));
    expect(section(root, "好調").textContent).not.toContain("パラメータ+ 3回");
  });

  test("a 開幕時獲得 the card cannot have is switched off, so the row can be saved and customized", async () => {
    const joju = cardNamed("成就+");
    await showPage(root, ok(addRow(emptyMemo(), "sense.kocho", "r1", { ...newBuild(joju.id, joju, HIF.ability.id), kaimaku: true })));
    expect(section(root, "好調").textContent).toContain("開幕時獲得");
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    await tap(byText(dialog(root), "button", "2 カスタマイズ"));
    await tap(byText(dialog(root), "button", "好調+ 1回"));
    expect(byText(dialog(root), "button", "好調+ 1回").getAttribute("aria-pressed")).toBe("true");
    await tap(byText(dialog(root), "button", "この内容で保存"));
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(section(root, "好調").textContent).not.toContain("開幕時獲得");
    expect(section(root, "好調").textContent).toContain("好調+ 1回");
  });
});

describe("changing a row of an N card that cannot be a produce memory (D54)", () => {
  test("the card counts as not chosen: it is not offered, cannot be saved again, and another card can be picked", async () => {
    const chosen = cardNamed("挑戦+");
    await showPage(root, ok(addRow(emptyMemo(), "sense.kocho", "r1", newBuild(chosen.id, chosen, HIF.ability.id))));
    const row = must(document.getElementById("row-r1"), "row r1");
    expect(row.textContent).toContain("挑戦+");
    expect(byLabel(row, "挑戦+").style.backgroundImage).toContain("sense-hski-");
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    expect([...dialog(root).querySelectorAll("button")].some((b) => b.textContent === "この内容で保存")).toBe(false);
    expect(byText(dialog(root), "button", "3 HIFアビリティ").hasAttribute("disabled")).toBe(true);
    expect([...dialog(root).querySelectorAll("button[aria-pressed] span:last-child")].map((s) => s.textContent)).not.toContain("挑戦+");
    await pick(root, "成就+");
    await tap(byText(dialog(root), "button", "次へ"));
    await pick(root, HIF.card.name);
    expect(must(document.getElementById("row-r1"), "row r1").textContent).toContain("成就+");
  });
});

describe("the popover", () => {
  test("moves again to stay on screen after the window is resized or the phone turned", async () => {
    await showPage(root, withJoju());
    await tap(byLabel(section(root, "好調"), "%F% 未所持"));
    const panel = dialog(root);
    const anchor = must(panel.parentElement, "the anchor");
    // happy-dom lays nothing out: an anchor at 0 and a panel of no width start at the 8 px margin.
    expect(panel.style.left).toBe("8px");
    Object.defineProperty(anchor, "getBoundingClientRect", { value: () => new DOMRect(100, 0, 88, 26), configurable: true });
    Object.defineProperty(panel, "offsetWidth", { value: 300, configurable: true });
    Object.defineProperty(document.documentElement, "clientWidth", { value: 250, configurable: true });
    try {
      await act(() => {
        window.dispatchEvent(new Event("resize"));
      });
      // Wider than the 250 px screen, from an anchor at 100: it starts at the left margin, 8 - 100.
      expect(panel.style.left).toBe("-92px");
    } finally {
      Reflect.deleteProperty(document.documentElement, "clientWidth");
    }
  });
});
