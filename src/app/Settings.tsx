import type { ComponentChildren } from "preact";
import type { Idol } from "../data/contract.ts";
import { HOME_SCREEN_HINT, suggestsHomeScreen, thisDevice } from "./install.ts";

/** The disclosure of D12, word for word. */
export const COUNTING_NOTE = "行を追加すると、選んだスキルカード・HIFアビリティ・カスタマイズとセクション名だけを匿名で集計し、候補の並び順に使います";

/** On an iPhone or iPad in the browser, why and how to add the page to the home screen (D16, D61). */
export function HomeScreenHint({ shown = suggestsHomeScreen(thisDevice()) }: { shown?: boolean }) {
  return shown ? <p class="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">{HOME_SCREEN_HINT}</p> : null;
}

/**
 * The settings near the footer: 「カードの絵柄」, the idol every card icon is drawn in (D20, D34),
 * then `children` (the 引き継ぎコード), and the counting note with its off switch last (D12;
 * Milestone 6 sends the counts).
 */
export function Settings({
  idols,
  idol,
  onIdol,
  counting,
  onCounting,
  children,
}: {
  idols: readonly Idol[];
  idol: string;
  onIdol: (idol: string) => void;
  counting: boolean;
  onCounting: (on: boolean) => void;
  children?: ComponentChildren;
}) {
  return (
    <footer class="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm">
      <label class="flex items-center gap-2">
        カードの絵柄
        <select class="rounded border border-slate-300 px-2 py-1" value={idol} onChange={(e) => onIdol(e.currentTarget.value)}>
          {idols.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      {children}
      <div class="flex items-start gap-3 text-xs text-slate-600">
        <p class="flex-1">{COUNTING_NOTE}</p>
        <label class="flex shrink-0 items-center gap-1">
          <input type="checkbox" checked={counting} onChange={(e) => onCounting(e.currentTarget.checked)} />
          集計に協力する
        </label>
      </div>
    </footer>
  );
}
