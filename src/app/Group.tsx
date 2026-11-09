import { useState } from "preact/hooks";
import { addExtraGroup, addMemory, changeMemory, deleteMemory, type GroupPattern, isRefusal, removeExtraGroup } from "../memo/edit.ts";
import { EXTRA_PATTERNS, type ExtraPattern, MAX_EXTRAS, type Memory, type Pattern, type Row } from "../memo/types.ts";
import { cellValues } from "../memo/values.ts";
import { type ColumnLabel, columnLabels, refusalText, STATS } from "./labels.ts";
import { MemoryEditor } from "./MemoryEditor.tsx";
import { usePage } from "./page.ts";
import { ArmedButton, Popover } from "./Popover.tsx";

/** One memory as a line of three cells, each in its tier's texture under its stat's colour (D2). */
export function MemoryLine({ pattern, memory, onClick }: { pattern: Pattern; memory: Memory; onClick: () => void }) {
  const values = cellValues(pattern, memory);
  return (
    <button type="button" aria-label={`${pattern} ${values.join(" / ")}`} class="flex gap-[var(--cell-gap)]" onClick={onClick}>
      {STATS.map((stat, i) => (
        <span key={stat.name} class={`cell tier-${memory[i] ?? "diamond"} flex items-center justify-center rounded-sm font-bold`} style={{ borderTop: `3px solid ${stat.color}` }}>
          {values[i]}
        </span>
      ))}
    </button>
  );
}

/** An extra group's two-tap removal by hand (D27): with its memories, which its armed label counts. */
function RemoveExtra({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  return (
    <div class="mt-2 border-t border-slate-100 pt-2">
      <ArmedButton label="このパターンを外す" armedLabel={count > 0 ? `メモリー${count}件も外す` : "もう一度押すと外す"} onConfirm={onConfirm} />
    </div>
  );
}

/**
 * One group of a row (D4, D9, D18): its memories stacked in the order entered, with a thin ＋ strip
 * under the last to add another, or the 未所持 block when it has none. Each opens the memory popover.
 * An extra group (`extra`) stays when its last memory goes, and its popover can remove it (D27).
 */
export function GroupView({ row, pattern, memories, extra }: { row: Row; pattern: GroupPattern; memories: readonly Memory[]; extra?: ExtraPattern }) {
  const { memo, setMemo } = usePage();
  /** The memory being edited, "new" for one being added, or null when closed. */
  const [open, setOpen] = useState<number | "new" | null>(null);
  const close = () => setOpen(null);
  const submit = (memory: Memory) => {
    setMemo(open === "new" || open === null ? addMemory(memo, row.id, pattern, memory) : changeMemory(memo, row.id, pattern, open, memory));
    close();
  };
  const remove = typeof open === "number" ? () => (setMemo(deleteMemory(memo, row.id, pattern, open)), close()) : undefined;
  return (
    <div class="memo-group relative flex shrink-0 flex-col gap-[var(--cell-gap)]">
      {memories.length === 0 ? (
        <button type="button" aria-label={`${pattern} 未所持`} class="missing h-[var(--cell-h)] w-full rounded-sm text-[length:var(--cell-font)] font-bold" onClick={() => setOpen("new")}>
          未所持
        </button>
      ) : (
        memories.map((memory, i) => <MemoryLine key={i} pattern={pattern} memory={memory} onClick={() => setOpen(i)} />)
      )}
      {memories.length > 0 && (
        <button type="button" aria-label={`${pattern}をもう1件追加`} class="h-3 w-full rounded-sm text-[10px] leading-3 text-slate-300 hover:bg-slate-100" onClick={() => setOpen("new")}>
          ＋
        </button>
      )}
      {open !== null && (
        <Popover label={`${pattern}のメモリー`} onClose={close}>
          <MemoryEditor pattern={pattern} initial={typeof open === "number" ? memories[open] : undefined} onSubmit={submit} onDelete={remove} />
          {extra !== undefined && <RemoveExtra count={memories.length} onConfirm={() => (setMemo(removeExtraGroup(memo, row.id, extra)), close())} />}
        </Popover>
      )}
    </div>
  );
}

/** A column's mark, its stat said only to assistive technology (#54). */
export function ColumnMark({ label, class: className, color }: { label: ColumnLabel; class: string; color?: string }) {
  return (
    <span class={className} style={color === undefined ? undefined : { borderColor: color }}>
      <span class="sr-only">{label.stat}</span>
      {label.mark}
    </span>
  );
}

/** The labels above an extra group, which the section header cannot know (Artifacts and Notes). */
function ExtraLabels({ pattern }: { pattern: ExtraPattern }) {
  return (
    <div class="flex gap-[var(--cell-gap)] text-[9px] leading-3 text-slate-500">
      {columnLabels(pattern).map((label) => (
        <ColumnMark key={label.stat} label={label} class="w-[var(--cell-w)] text-center" />
      ))}
    </div>
  );
}

/** The extra patterns with a button of their own on every row, %%% and FFF (D3); the rest are under 「＋他」. */
const QUICK_PATTERNS = EXTRA_PATTERNS.slice(0, 2);
const OTHER_PATTERNS = EXTRA_PATTERNS.slice(2);

function AddButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} class="h-[var(--cell-h)] rounded-sm border border-dashed border-slate-300 px-1.5 font-mono text-[length:var(--cell-font)] whitespace-nowrap text-slate-500" onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * The 追加 buttons, each saying what it adds (#70): 「＋%%%」 and 「＋FFF」 while the row has not
 * got them, straight to the memory (D3), and 「＋他」 for %FF, F%F and FF%, the ones the row has
 * greyed out, then the memory (D18).
 */
function AddExtra({ row }: { row: Row }) {
  const { memo, setMemo } = usePage();
  /** "others" while the rarer patterns are offered, a pattern once chosen, or null when closed. */
  const [open, setOpen] = useState<ExtraPattern | "others" | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const close = () => (setOpen(null), setRefused(null));
  const submit = (memory: Memory) => {
    if (open === null || open === "others") return;
    const result = addExtraGroup(memo, row.id, open, memory);
    if (isRefusal(result)) return setRefused(refusalText(result));
    setMemo(result);
    close();
  };
  const taken = new Set(row.extras.map((g) => g.pattern));
  return (
    <div class="relative flex gap-[var(--cell-gap)]">
      {QUICK_PATTERNS.filter((p) => !taken.has(p)).map((p) => (
        <AddButton key={p} label={`${p}を追加`} onClick={() => setOpen(p)}>{`＋${p}`}</AddButton>
      ))}
      <AddButton label="ほかのパターンを追加" onClick={() => setOpen("others")}>
        ＋他
      </AddButton>
      {open !== null && (
        <Popover label="パターンを追加" onClose={close}>
          {open === "others" ? (
            <div class="flex gap-1">
              {OTHER_PATTERNS.map((p) => (
                <button key={p} type="button" disabled={taken.has(p)} class="btn px-2 py-1 font-mono disabled:opacity-30" onClick={() => setOpen(p)}>
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <MemoryEditor pattern={open} onSubmit={submit} />
          )}
          {refused !== null && <p role="alert" class="mt-1 text-xs text-rose-600">{refused}</p>}
        </Popover>
      )}
    </div>
  );
}

/** The 追加 area: the row's extra groups with their patterns above them, empty ones too (D27), and the 追加 buttons while there is room. */
export function ExtrasArea({ row }: { row: Row }) {
  return (
    <div class="flex items-start gap-[var(--group-gap)]">
      {row.extras.map((group) => (
        <div key={group.pattern} class="flex flex-col">
          <ExtraLabels pattern={group.pattern} />
          <GroupView row={row} pattern={group.pattern} memories={group.memories} extra={group.pattern} />
        </div>
      ))}
      {row.extras.length < MAX_EXTRAS && <AddExtra row={row} />}
    </div>
  );
}
