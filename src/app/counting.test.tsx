/** The page's counting in a simulated DOM (happy-dom): the event a new row sends, the switch, and the pickers' order by the counts (Milestone 6). */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { CountEvent } from "../../infra/worker/count-contract.ts";
import { newBuild } from "../memo/build.ts";
import { addRow, isRefusal } from "../memo/edit.ts";
import { emptyMemo, type Memo, SECTION_IDS } from "../memo/types.ts";
import { addRowThroughPopover, byLabel, byText, CATALOG, dialog, must, pick, section, settle, showPage, tap, TEST_SHEETS, type } from "../test-support/page.tsx";
import { cardNamed, kindLabelled } from "../test-support/skillcards.ts";
import type { Counts, CountsApi, SectionCounts } from "./counts.ts";
import { MemoPage } from "./MemoPage.tsx";
import { atLevel } from "./picker.ts";

const JOJU = cardNamed("成就+"); // センス SSR +: 好調+ and コスト値- of one step each, no 開幕時獲得
const SENSE_CARDS = CATALOG.tabCards("sense");
const SENSE_ABILITIES = CATALOG.tabAbilities("sense");
const HIF = must(SENSE_ABILITIES[0], "a センス ability");

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

/** A fake of the Worker: the counts it answers (or a promise of them) and every event sent. */
function fakeApi(load: () => Promise<Counts | null> = async () => null): CountsApi & { sent: CountEvent[] } {
  const sent: CountEvent[] = [];
  return { sent, load, send: (event) => void sent.push(event) };
}

function counts(of: Partial<Record<(typeof SECTION_IDS)[number], Partial<SectionCounts>>>): Counts {
  return new Map(SECTION_IDS.map((s) => [s, { card: of[s]?.card ?? new Map(), hif: of[s]?.hif ?? new Map(), customization: new Map() }]));
}

function withJoju(): Memo {
  const result = addRow(emptyMemo(), "sense.kocho", "r1", newBuild(JOJU.id, JOJU, HIF.ability.id));
  if (isRefusal(result)) throw new Error("refused");
  return result;
}

/** The names in the open popover's icon grid, in order. */
const gridNames = () => [...dialog(root).querySelectorAll(".grid > button")].map((b) => b.querySelector("span:last-child")?.textContent);
const countingSwitch = () => must(byText(root, "label", "集計に協力する").querySelector("input"), "the counting switch");

describe("a new row's count event", () => {
  test("is sent once when a row is created: the section, the card and its level, the ability and the customization (D11)", async () => {
    const api = fakeApi();
    await showPage(root, undefined, TEST_SHEETS, api);
    await tap(byText(section(root, "共通"), "button", "＋ カードを追加"));
    await type(byLabel(dialog(root), "カード名"), "成就+");
    await pick(root, "成就+");
    await tap(byText(dialog(root), "button", "好調+ 1回"));
    await tap(byText(dialog(root), "button", "次へ"));
    expect(api.sent).toEqual([]);
    await pick(root, HIF.card.name);
    expect(api.sent).toEqual([{ section: "sense.common", card: JOJU.id, upgrade: 1, hif: HIF.ability.id, customization: [`${kindLabelled(JOJU, "好調+")}:1`] }]);
    expect(section(root, "共通").textContent).toContain("成就+");
  });

  test("is not sent while 「集計に協力する」 is off, and is again once it is back on (D12)", async () => {
    const api = fakeApi();
    await showPage(root, undefined, TEST_SHEETS, api);
    expect(countingSwitch().checked).toBe(true);
    await tap(countingSwitch());
    await addRowThroughPopover(root, "好調", "成就+", HIF.card.name);
    expect(section(root, "好調").textContent).toContain("成就+");
    expect(api.sent).toEqual([]);
    await tap(countingSwitch());
    expect(countingSwitch().checked).toBe(true);
    await addRowThroughPopover(root, "集中", "成就", HIF.card.name);
    expect(api.sent.map((e) => [e.section, e.upgrade])).toEqual([["sense.shuchu", 0]]);
  });

  test("is sent once for a double tap on the ability, which adds one row", async () => {
    const api = fakeApi();
    await showPage(root, undefined, TEST_SHEETS, api);
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    await type(byLabel(dialog(root), "カード名"), "成就+");
    await pick(root, "成就+");
    await tap(byText(dialog(root), "button", "次へ"));
    const ability = must([...dialog(root).querySelectorAll<HTMLElement>(".grid > button")][0], "an ability");
    // Two taps before the page draws again, as no browser delivers them but nothing forbids.
    await act(() => {
      ability.click();
      ability.click();
    });
    expect(api.sent.length).toBe(1);
    expect(section(root, "好調").querySelectorAll("[data-row]").length).toBe(1);
  });

  test("is not sent for a build the tab already holds, refused (D13)", async () => {
    const api = fakeApi();
    await showPage(root, withJoju(), TEST_SHEETS, api);
    await addRowThroughPopover(root, "集中", "成就+", HIF.card.name);
    expect(byText(dialog(root), '[role="alert"]', "同じ組み合わせが「好調」にありますその行へ").textContent).toBeTruthy();
    expect(api.sent).toEqual([]);
  });

  test("is not sent when a row is changed, moved or deleted (D11)", async () => {
    const api = fakeApi();
    await showPage(root, withJoju(), TEST_SHEETS, api);
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    await tap(byText(dialog(root), "button", "2 カスタマイズ"));
    await tap(byText(dialog(root), "button", "好調+ 1回"));
    await tap(byText(dialog(root), "button", "この内容で保存"));
    expect(section(root, "好調").textContent).toContain("好調+ 1回");
    await tap(byLabel(section(root, "好調"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "共通"));
    expect(section(root, "共通").textContent).toContain("成就+");
    await tap(byLabel(section(root, "共通"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "行を削除"));
    await tap(byText(dialog(root), "button", "もう一度押すと削除"));
    expect(section(root, "共通").textContent).not.toContain("成就+");
    expect(api.sent).toEqual([]);
  });
});

describe("the pickers' order", () => {
  /** The cards the card step opens on: the enhanced ones (D66). */
  const OPENING = atLevel(SENSE_CARDS, 1);
  const lastPlanCard = must(OPENING.filter((c) => c.plan === "sense").at(-1), "the last センス card");
  const lastFreeCard = must(OPENING.at(-1), "the last free card");
  const firstFree = OPENING.findIndex((c) => c.plan === "free");
  const lastAbility = must(SENSE_ABILITIES.at(-1), "the last センス ability");
  const KOCHO = counts({
    "sense.kocho": {
      card: new Map([
        [`${lastPlanCard.id}:${lastPlanCard.upgrade}`, 2],
        [`${lastFreeCard.id}:${lastFreeCard.upgrade}`, 5],
      ]),
      hif: new Map([[lastAbility.ability.id, 1]]),
    },
  });

  test("ranks each block of the card step, and the ability step, by the counts of the section the popover was opened in", async () => {
    await showPage(root, undefined, TEST_SHEETS, fakeApi(async () => KOCHO));
    await settle();
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    const names = gridNames();
    expect(names[0]).toBe(lastPlanCard.name);
    expect(names[firstFree]).toBe(lastFreeCard.name);
    expect(names.length).toBe(OPENING.length);
    await pick(root, "成就+");
    await tap(byText(dialog(root), "button", "次へ"));
    expect(gridNames()[0]).toBe(lastAbility.card.name);
  });

  test("keeps the game's order in a section with no counts", async () => {
    await showPage(root, undefined, TEST_SHEETS, fakeApi(async () => KOCHO));
    await settle();
    await tap(byText(section(root, "集中"), "button", "＋ カードを追加"));
    expect(gridNames()).toEqual(OPENING.map((c) => c.name));
  });

  test("ranks within a search and a rarity filter too", async () => {
    await showPage(root, undefined, TEST_SHEETS, fakeApi(async () => KOCHO));
    await settle();
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    await tap(byText(byLabel(dialog(root), "レアリティ"), "button", lastPlanCard.rarity));
    expect(gridNames()[0]).toBe(lastPlanCard.name);
  });

  test("keeps the game's order until the counts load, and when they cannot", async () => {
    let arrive: (value: Counts | null) => void = () => undefined;
    await showPage(root, undefined, TEST_SHEETS, fakeApi(() => new Promise((resolve) => (arrive = resolve))));
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    expect(gridNames()[0]).toBe(OPENING[0]?.name);
    await act(() => arrive(KOCHO));
    await settle();
    expect(gridNames()[0]).toBe(lastPlanCard.name);
    await act(() => render(null, root));
    await showPage(root, undefined, TEST_SHEETS, fakeApi(async () => null));
    await settle();
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    expect(gridNames()).toEqual(OPENING.map((c) => c.name));
  });

  test("ranks 変更's card step by the row's own section", async () => {
    const SHUCHU = counts({ "sense.shuchu": { card: new Map([[`${lastPlanCard.id}:${lastPlanCard.upgrade}`, 1]]) } });
    const inShuchu = addRow(emptyMemo(), "sense.shuchu", "r1", newBuild(JOJU.id, JOJU, HIF.ability.id));
    if (isRefusal(inShuchu)) throw new Error("refused");
    await showPage(root, inShuchu, TEST_SHEETS, fakeApi(async () => SHUCHU));
    await settle();
    await tap(byLabel(section(root, "集中"), "行のメニュー"));
    await tap(byText(dialog(root), "button", "変更"));
    expect(gridNames()[0]).toBe(lastPlanCard.name);
  });

  test("drops an answer that comes after another CountsApi was given", async () => {
    let slow: (value: Counts | null) => void = () => undefined;
    const first = fakeApi(() => new Promise((resolve) => (slow = resolve)));
    await showPage(root, undefined, TEST_SHEETS, first);
    await act(() => render(<MemoPage catalog={CATALOG} sheets={TEST_SHEETS} countsApi={fakeApi(async () => KOCHO)} />, root));
    await settle();
    await act(() => slow(counts({})));
    await settle();
    await tap(byText(section(root, "好調"), "button", "＋ カードを追加"));
    expect(gridNames()[0]).toBe(lastPlanCard.name);
  });

  test("loads the counts once, however often the page draws", async () => {
    let loads = 0;
    await showPage(root, undefined, TEST_SHEETS, fakeApi(async () => (loads++, KOCHO)));
    await settle();
    await addRowThroughPopover(root, "好調", "成就+", HIF.card.name);
    await tap(countingSwitch());
    expect(loads).toBe(1);
  });
});
