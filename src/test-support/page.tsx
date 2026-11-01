/**
 * The memo page in a simulated DOM (happy-dom) for component tests: rendering it over the fixture,
 * an icon index made from the fixture the way scripts/icons/build.py makes it, and finding
 * and tapping controls by what the player reads. No layout: how it looks is checked in a browser.
 */

import { render } from "preact";
import { act } from "preact/test-utils";
import { makeCatalog } from "../app/catalog.ts";
import type { CountsApi } from "../app/counts.ts";
import { MemoPage } from "../app/MemoPage.tsx";
import type { IconIndex } from "../app/sheets.ts";
import { type Memo, PLAN_IDS } from "../memo/types.ts";
import { SKILL_CARDS } from "./skillcards.ts";

export const CATALOG = makeCatalog(SKILL_CARDS);

/**
 * Sheets of every plan for two idols, holding every card the tabs offer at both levels, as
 * scripts/icons/build.py builds them: not the N cards the pickers leave out (D54), which a saved
 * row can still hold and which are then drawn as their frame.
 */
export const TEST_SHEETS: IconIndex = {
  cell: 112,
  columns: 10,
  plans: PLAN_IDS.map((plan) => ({
    plan,
    cells: CATALOG.tabCards(plan).map((c) => `${c.id}:${c.upgrade}`),
    sheets: ["hski", "ttmr"].map((idol) => ({ idol, file: `gkms-memomemo/sheet112/${plan}-${idol}-0000000${idol === "hski" ? 1 : 2}.webp` })),
  })),
};

export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

export async function showPage(root: HTMLElement, initial?: Memo, sheets: IconIndex = TEST_SHEETS, countsApi?: CountsApi): Promise<void> {
  await act(() => render(<MemoPage catalog={CATALOG} sheets={sheets} initial={initial} countsApi={countsApi} />, root));
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

/**
 * Lets what the page awaits settle (a 引き継ぎコード's compression, a loader). Compression streams
 * finish over several turns of the event loop, so this waits a few timer turns, not one.
 */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await act(() => new Promise((resolve) => setTimeout(resolve, 1)));
}

export async function tap(el: HTMLElement): Promise<void> {
  await act(() => el.click());
}

export async function type(input: HTMLElement, text: string): Promise<void> {
  await act(() => {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.value = text;
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
