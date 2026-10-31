/** The memo page's tab-wide parts in a simulated DOM (happy-dom): sorting, extra groups, the 早見表, the toggle, art, unknown rows. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { newBuild } from "../memo/build.ts";
import { addMemory, addRow, type Edited, isRefusal } from "../memo/edit.ts";
import { emptyMemo, FIXED_PATTERNS, type Memo, type Memory } from "../memo/types.ts";
import { byLabel, byText, CATALOG, dialog, must, pick, section, showPage, tap } from "../test-support/page.tsx";
import { cardNamed } from "../test-support/skillcards.ts";

const HIF = must(CATALOG.tabAbilities("sense")[0], "a センス ability").ability.id;
const DDR: Memory = ["diamond", "diamond", "rainbow"];

function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

function withRow(memo: Memo, id: string, name: string, section: keyof Memo["sections"] = "sense.kocho"): Memo {
  const card = cardNamed(name);
  return ok(addRow(memo, section, id, newBuild(card.id, card, HIF)));
}

/** ファンサ+ (R) then 成就+ (SSR) in 好調. */
const TWO_ROWS = withRow(withRow(emptyMemo(), "r1", "ファンサ+"), "r2", "成就+");

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

const rowOrder = (label: string) => [...section(root, label).querySelectorAll("[data-row]")].map((el) => el.getAttribute("data-row"));

describe("sorting", () => {
  test("sorts a section by レアリティ, and 元に戻す brings the order back (D15)", async () => {
    await showPage(root, TWO_ROWS);
    await tap(byText(section(root, "好調"), "button", "並べ替え"));
    await tap(byText(dialog(root), "button", "レアリティ順"));
    expect(rowOrder("好調")).toEqual(["r2", "r1"]);
    await tap(byText(byText(root, '[role="status"] div', "好調をレアリティ順に並べ替えました元に戻す"), "button", "元に戻す"));
    expect(rowOrder("好調")).toEqual(["r1", "r2"]);
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  test("the undo is withdrawn once the memo changes otherwise", async () => {
    await showPage(root, TWO_ROWS);
    await tap(byText(section(root, "好調"), "button", "並べ替え"));
    await tap(byText(dialog(root), "button", "レアリティ順"));
    await tap(byLabel(section(root, "好調"), "%%F 未所持"));
    for (const tier of ["Vo ダイヤ 3.5", "Da ダイヤ 3.5", "Vi 虹 20"]) await tap(byLabel(dialog(root), tier));
    await tap(byText(dialog(root), "button", "追加"));
    expect(root.querySelector('[role="status"]')).toBeNull();
  });
});

describe("extra groups", () => {
  test("「＋追加」 adds a %%% group, and a second %%% is greyed out (D3)", async () => {
    await showPage(root, withRow(emptyMemo(), "r1", "成就+"));
    await tap(byText(section(root, "好調"), "button", "＋追加"));
    await tap(byText(dialog(root), "button", "%%%"));
    for (const tier of ["Vo 虹 2.8", "Da 虹 2.8", "Vi 虹 2.8"]) await tap(byLabel(dialog(root), tier));
    await tap(byText(dialog(root), "button", "追加"));
    expect(byLabel(section(root, "好調"), "%%% 2.8 / 2.8 / 2.8")).toBeTruthy();
    await tap(byText(section(root, "好調"), "button", "＋追加"));
    expect(byText(dialog(root), "button", "%%%").hasAttribute("disabled")).toBe(true);
    expect(byText(dialog(root), "button", "FFF").hasAttribute("disabled")).toBe(false);
  });
});

describe("the 早見表 and the toggle", () => {
  /** ファンサ+ owns all three fixed patterns; 成就+ none. */
  const complete = FIXED_PATTERNS.reduce((m, p) => addMemory(m, "r1", p, DDR), TWO_ROWS);
  const toggle = () => act(() => must(byText(root, "label", "未所持がある行だけ表示").querySelector("input"), "the toggle").click());

  test("「未所持がある行だけ表示」 hides rows whose three fixed patterns are all owned", async () => {
    await showPage(root, complete);
    await toggle();
    expect(rowOrder("好調")).toEqual(["r2"]);
    expect(section(root, "好調").textContent).toContain("ほかに1行（すべて所持）");
  });

  test("a line of the 早見表 jumps to its row, showing it again if the toggle hid it", async () => {
    await showPage(root, complete);
    await toggle();
    const line = must([...must(root.querySelector("details"), "早見表").querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("ファンサ+") === true), "the line");
    expect(line.textContent).toBe("ファンサ+✓✓✓");
    await tap(line);
    expect(rowOrder("好調")).toEqual(["r1", "r2"]);
    expect(must(document.getElementById("row-r1"), "row r1").className).toContain("highlight");
  });
});

describe("art and unknown rows", () => {
  test("「カードの絵柄」 draws every icon from the chosen idol's sheet (D20)", async () => {
    await showPage(root, TWO_ROWS);
    const urls = () => [...section(root, "好調").querySelectorAll<HTMLElement>('[role="img"]')].map((el) => el.style.backgroundImage);
    expect(urls().every((u) => u.includes("sense-hski-"))).toBe(true);
    const select = must(root.querySelector("select"), "カードの絵柄");
    await act(() => {
      select.value = "ttmr";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(urls().length).toBe(4);
    expect(urls().every((u) => u.includes("sense-ttmr-"))).toBe(true);
  });

  test("without sheets every icon is drawn as its card's name", async () => {
    await showPage(root, TWO_ROWS, { cell: 112, sheets: [] });
    const icons = [...section(root, "好調").querySelectorAll<HTMLElement>('[role="img"]')];
    expect(icons.every((el) => el.style.backgroundImage === "")).toBe(true);
    expect(icons[0]?.textContent).toBe("ファンサ+");
  });

  test("a row whose card the data lacks is drawn as unknown and keeps its memories and menu (D31)", async () => {
    const memo = addMemory(ok(addRow(emptyMemo(), "sense.kocho", "r9", { card: "p_card-01-act-9_999", upgrade: 1, customization: [], kaimaku: false, hif: HIF })), "r9", "%%F", DDR);
    await showPage(root, memo);
    const kocho = section(root, "好調");
    expect(kocho.textContent).toContain("不明なカード");
    expect(byLabel(kocho, "%%F 3.5 / 3.5 / 20")).toBeTruthy();
    expect(byLabel(kocho, "行のメニュー")).toBeTruthy();
  });
});

describe("dragging", () => {
  const handleOf = (rowId: string) => byLabel(must(document.getElementById(`row-${rowId}`), rowId), "並べ替えのハンドル");
  const pointer = (el: HTMLElement, type: string, clientY: number) =>
    act(() => {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientY }));
    });

  test("a release lands where the pointer is, even with no move drawn before it", async () => {
    // happy-dom lays nothing out: every row's middle is at 0, so a release at 10 is below them all.
    await showPage(root, TWO_ROWS);
    await pointer(handleOf("r1"), "pointerdown", 0);
    await pointer(handleOf("r1"), "pointerup", 10);
    expect(rowOrder("好調")).toEqual(["r2", "r1"]);
  });

  test("a tap on the handle moves nothing and keeps the sort's undo offered", async () => {
    await showPage(root, TWO_ROWS);
    await tap(byText(section(root, "好調"), "button", "並べ替え"));
    await tap(byText(dialog(root), "button", "レアリティ順"));
    await pointer(handleOf("r2"), "pointerdown", 0);
    await pointer(handleOf("r2"), "pointerup", 0);
    expect(rowOrder("好調")).toEqual(["r2", "r1"]);
    expect(root.querySelector('[role="status"]')).not.toBeNull();
  });
});

describe("unknown rows (D31)", () => {
  const unknownCard = { card: "p_card-01-act-9_999", upgrade: 1, customization: [], kaimaku: false, hif: HIF };

  test("an ability the data lacks is drawn as unknown, the card as it is", async () => {
    const card = cardNamed("成就+");
    await showPage(root, ok(addRow(emptyMemo(), "sense.kocho", "r1", { ...newBuild(card.id, card, HIF), hif: "memory_ability-gone" })));
    expect(byLabel(section(root, "好調"), "不明なHIF")).toBeTruthy();
    expect(section(root, "好調").textContent).toContain("成就+");
  });

  test("a row whose card the data lacks can be deleted, two taps", async () => {
    await showPage(root, ok(addRow(emptyMemo(), "sense.kocho", "r9", unknownCard)));
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "行を削除"));
    await tap(byText(dialog(root), "button", "もう一度押すと削除"));
    expect(rowOrder("好調")).toEqual([]);
  });

  test("a row whose card the data lacks can be changed to a known card, keeping its memories", async () => {
    await showPage(root, addMemory(ok(addRow(emptyMemo(), "sense.kocho", "r9", unknownCard)), "r9", "%%F", DDR));
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    await pick(root, "成就+");
    await tap(byText(dialog(root), "button", "次へ"));
    await pick(root, CATALOG.tabAbilities("sense")[1]?.card.name ?? "");
    expect(rowOrder("好調")).toEqual(["r9"]);
    const row = must(document.getElementById("row-r9"), "row r9");
    expect(row.textContent).toContain("成就+");
    expect(row.textContent).not.toContain("不明なカード");
    expect(byLabel(row, "%%F 3.5 / 3.5 / 20")).toBeTruthy();
  });
});
