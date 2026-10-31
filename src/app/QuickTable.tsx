import { rowCoverage } from "../memo/coverage.ts";
import { FIXED_PATTERNS, type PlanId, type Row, sectionsOf } from "../memo/types.ts";
import { CardIcon } from "./Icon.tsx";
import { SECTION_LABELS } from "./labels.ts";
import { usePage } from "./page.ts";

/** A fixed pattern's square: ✓ for one memory, ×N for several, a dashed box for none (D9). */
function Square({ count }: { count: number }) {
  if (count === 0) return <span aria-label="未所持" class="h-[18px] w-[26px] rounded-sm border-2 border-dashed border-[#f0a1bf]" />;
  return (
    <span class="flex h-[18px] w-[26px] items-center justify-center rounded-sm bg-[#2f9e6a] text-[10px] font-bold text-white">{count === 1 ? "✓" : `×${count}`}</span>
  );
}

function QuickLine({ row, plan, onJump }: { row: Row; plan: PlanId; onJump: () => void }) {
  const { catalog } = usePage();
  const card = catalog.card(row.build.card, row.build.upgrade);
  const name = card?.name ?? "不明なカード";
  const coverage = rowCoverage(row);
  return (
    <button type="button" class="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-50" onClick={onJump}>
      <CardIcon card={card} plan={plan} size="24px" name={name} />
      <span class="w-24 shrink-0 truncate text-xs">{name}</span>
      {FIXED_PATTERNS.map((p) => (
        <Square key={p} count={coverage.fixed[p]} />
      ))}
      {coverage.extras.map((p) => (
        <span key={p} class="rounded-sm bg-slate-200 px-1 font-mono text-[10px] text-slate-600">
          {p}
        </span>
      ))}
    </button>
  );
}

/**
 * The 早見表 (D9): folded by default, a line per row of the tab with a square per fixed pattern and
 * grey tags for owned extra patterns; tapping a line jumps to the row.
 */
export function QuickTable({ plan }: { plan: PlanId }) {
  const { memo, jumpTo } = usePage();
  const sections = sectionsOf(plan).filter((s) => memo.sections[s].length > 0);
  return (
    <details class="rounded-lg bg-white shadow-sm">
      <summary class="cursor-pointer px-3 py-2 font-bold">早見表</summary>
      <div class="flex flex-col gap-2 px-2 pb-2">
        {sections.length === 0 && <p class="text-xs text-slate-500">まだ行がありません</p>}
        {sections.length > 0 && (
          <div class="flex items-center gap-2 pl-[calc(24px+6rem+1.25rem)] font-mono text-[10px] text-slate-500">
            {FIXED_PATTERNS.map((p) => (
              <span key={p} class="w-[26px] text-center">
                {p}
              </span>
            ))}
          </div>
        )}
        {sections.map((section) => (
          <div key={section}>
            <h3 class="text-xs text-slate-500">{SECTION_LABELS[section]}</h3>
            {memo.sections[section].map((row) => (
              <QuickLine key={row.id} row={row} plan={plan} onJump={() => jumpTo(row.id)} />
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
