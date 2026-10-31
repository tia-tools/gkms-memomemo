import type { Idol } from "../data/contract.ts";

/** The disclosure of D12, word for word. */
export const COUNTING_NOTE = "行を追加すると、選んだスキルカード・HIFアビリティ・カスタマイズとセクション名だけを匿名で集計し、候補の並び順に使います";

/**
 * The settings near the footer: 「カードの絵柄」, the idol every card icon is drawn in (D20, D34), and
 * the counting note with its off switch (D12; Milestone 6 sends the counts).
 */
export function Settings({
  idols,
  idol,
  onIdol,
  counting,
  onCounting,
}: {
  idols: readonly Idol[];
  idol: string;
  onIdol: (idol: string) => void;
  counting: boolean;
  onCounting: (on: boolean) => void;
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
