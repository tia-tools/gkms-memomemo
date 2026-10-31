/**
 * The memo page in a simulated DOM (happy-dom) for component tests: rendering it over the fixture,
 * a sprite sheet index made from the fixture the way gakumas-supportcards makes it, and finding
 * and tapping controls by what the player reads. No layout: how it looks is checked in a browser.
 */

import { render } from "preact";
import { act } from "preact/test-utils";
import { makeCatalog } from "../app/catalog.ts";
import { MemoPage } from "../app/MemoPage.tsx";
import type { SheetIndex } from "../app/sheets.ts";
import { type Memo, PLAN_IDS } from "../memo/types.ts";
import { SKILL_CARDS } from "./skillcards.ts";

export const CATALOG = makeCatalog(SKILL_CARDS);

/** One sheet per plan for two idols, holding every card the tab offers, as supportcards builds them. */
export const TEST_SHEETS: SheetIndex = {
  cell: 112,
  sheets: PLAN_IDS.flatMap((plan) =>
    ["hski", "ttmr"].map((idol) => {
      const assets = [...new Set(CATALOG.tabCards(plan).map((c) => (c.art.perIdol ? `${c.art.asset}-${idol}` : c.art.asset)))];
      return { plan, idol, file: `sheet112/${plan}-${idol}-0000000${idol === "hski" ? 1 : 2}.webp`, columns: 10, assets };
    }),
  ),
};

export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

export async function showPage(root: HTMLElement, initial?: Memo, sheets: SheetIndex = TEST_SHEETS): Promise<void> {
  await act(() => render(<MemoPage catalog={CATALOG} sheets={sheets} initial={initial} />, root));
}

/** The element inside `within` matching the selector whose text is exactly `text`. */
export function byText(within: ParentNode, selector: string, text: string): HTMLElement {
  return must([...within.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.trim() === text), `${selector} "${text}"`);
}

export function byLabel(within: ParentNode, label: string): HTMLElement {
  return must(within.querySelector<HTMLElement>(`[aria-label="${label}"]`), `[aria-label="${label}"]`);
}

export function section(root: ParentNode, label: string): HTMLElement {
  return must(root.querySelector<HTMLElement>(`section[aria-label="${label}"]`), `section ${label}`);
}

export function dialog(root: ParentNode): HTMLElement {
  return must([...root.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1), "an open popover");
}

export async function tap(el: HTMLElement): Promise<void> {
  await act(() => el.click());
}

export async function type(input: HTMLElement, text: string): Promise<void> {
  await act(() => {
    if (input instanceof HTMLInputElement) input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** A pick in the open row popover's grid: the button showing that name. */
export async function pick(root: ParentNode, name: string): Promise<void> {
  await tap(must([...dialog(root).querySelectorAll<HTMLElement>("button[aria-pressed]")].find((b) => b.querySelector("span:last-child")?.textContent === name), `pick ${name}`));
}

/** Adds a row through 「＋ カードを追加」: the card, 次へ past the customization if shown, the ability. */
export async function addRowThroughPopover(root: HTMLElement, sectionLabel: string, card: string, hifCard: string): Promise<void> {
  await tap(byText(section(root, sectionLabel), "button", "＋ カードを追加"));
  await type(byLabel(dialog(root), "カード名"), card);
  await pick(root, card);
  const next = [...dialog(root).querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "次へ");
  if (next !== undefined) await tap(next);
  await pick(root, hifCard);
}
