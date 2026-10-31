import type { VNode } from "preact";
import { useState } from "preact/hooks";
import { hasGaps } from "../memo/coverage.ts";
import { FIXED_PATTERNS, type PlanId, type Row, type SectionId } from "../memo/types.ts";
import { columnLabels, SECTION_LABELS, STATS } from "./labels.ts";
import { usePage } from "./page.ts";
import { RowPopover } from "./RowPopover.tsx";
import { RowView } from "./RowView.tsx";
import { type Drag, useRowDrag } from "./useRowDrag.ts";

/** The fixed groups' column labels under their stats' colours, aligned with the rows' groups. */
function ColumnHeader() {
  return (
    <div class="flex items-end gap-x-[var(--group-gap)] text-[10px] text-slate-600">
      <span class="w-[var(--controls)] shrink-0" />
      <span class="w-[var(--card-col)] shrink-0" />
      {FIXED_PATTERNS.map((pattern) => (
        <div key={pattern} class="memo-group flex shrink-0 gap-[var(--cell-gap)]">
          {columnLabels(pattern).map((label, i) => (
            <span key={label} class="w-[var(--cell-w)] border-t-[3px] text-center" style={{ borderColor: STATS[i]?.color }}>
              {label}
            </span>
          ))}
        </div>
      ))}
      <span class="hidden min-[600px]:block">追加</span>
    </div>
  );
}

/** 「＋ カードを追加」 at the section's end, opening the row popover in place (D19). */
function AddCard({ plan, section }: { plan: PlanId; section: SectionId }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="relative mt-1">
      <button type="button" class="rounded border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-600" onClick={() => setOpen(true)}>
        ＋ カードを追加
      </button>
      {open && <RowPopover plan={plan} section={section} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The shown rows, with a line where the dragged row would land. */
function rowsWithDropLine(shown: readonly Row[], drag: Drag | null, render: (row: Row, index: number) => VNode): VNode[] {
  const line = <div key="drop" class="h-0.5 bg-pink-500" />;
  const items: VNode[] = [];
  let others = 0;
  shown.forEach((row, i) => {
    const dragged = drag?.id === row.id;
    if (!dragged && drag?.over === others) items.push(line);
    items.push(render(row, i));
    if (!dragged) others += 1;
  });
  if (drag !== null && drag.over === others) items.push(line);
  return items;
}

/** One section of a tab (D9, D14): its header, its rows in the player's order, and 「＋ カードを追加」. */
export function SectionView({ section, plan, gapsOnly }: { section: SectionId; plan: PlanId; gapsOnly: boolean }) {
  const { memo } = usePage();
  const rows = memo.sections[section];
  const shown = gapsOnly ? rows.filter(hasGaps) : rows;
  const { list, drag, handle } = useRowDrag(rows, shown);
  return (
    <section class="flex flex-col gap-1 rounded-lg bg-white p-1 shadow-sm min-[600px]:p-2" aria-label={SECTION_LABELS[section]}>
      <h2 class="font-bold">{SECTION_LABELS[section]}</h2>
      {rows.length > 0 && <ColumnHeader />}
      <div ref={list}>
        {rowsWithDropLine(shown, drag, (row, i) => (
          <RowView key={row.id} row={row} section={section} plan={plan} handle={handle(row, i)} dragging={drag?.id === row.id} />
        ))}
      </div>
      {shown.length < rows.length && <p class="text-xs text-slate-400">ほかに{rows.length - shown.length}行（すべて所持）</p>}
      <AddCard plan={plan} section={section} />
    </section>
  );
}
