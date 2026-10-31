import { useState } from "preact/hooks";
import { addExtraGroup, addMemory, changeMemory, deleteMemory, type GroupPattern, isRefusal } from "../memo/edit.ts";
import { EXTRA_PATTERNS, type ExtraPattern, MAX_EXTRAS, type Memory, type Pattern, type Row } from "../memo/types.ts";
import { cellValues } from "../memo/values.ts";
import { columnLabels, refusalText, STATS } from "./labels.ts";
import { MemoryEditor } from "./MemoryEditor.tsx";
import { usePage } from "./page.ts";
import { Popover } from "./Popover.tsx";

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

/**
 * One group of a row (D4, D9, D18): its memories stacked in the order entered, with a thin ＋ strip
 * under the last to add another, or the 未所持 block when it has none. Each opens the memory popover.
 */
export function GroupView({ row, pattern, memories }: { row: Row; pattern: GroupPattern; memories: readonly Memory[] }) {
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
        </Popover>
      )}
    </div>
  );
}

/** The labels above an extra group, which the section header cannot know (Artifacts and Notes). */
function ExtraLabels({ pattern }: { pattern: ExtraPattern }) {
  return (
    <div class="flex gap-[var(--cell-gap)] text-[9px] leading-3 text-slate-500">
      {columnLabels(pattern).map((label) => (
        <span key={label} class="w-[var(--cell-w)] text-center">
          {label}
        </span>
      ))}
    </div>
  );
}

/** 「＋追加」: the pattern first, the ones the row has greyed out, then the memory (D3, D18). */
function AddExtra({ row }: { row: Row }) {
  const { memo, setMemo } = usePage();
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState<ExtraPattern | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const close = () => (setOpen(false), setPattern(null), setRefused(null));
  const submit = (memory: Memory) => {
    if (pattern === null) return;
    const result = addExtraGroup(memo, row.id, pattern, memory);
    if (isRefusal(result)) return setRefused(refusalText(result));
    setMemo(result);
    close();
  };
  const taken = new Set(row.extras.map((g) => g.pattern));
  return (
    <div class="relative">
      <button type="button" class="h-[var(--cell-h)] rounded-sm border border-dashed border-slate-300 px-2 text-[length:var(--cell-font)] text-slate-500" onClick={() => setOpen(true)}>
        ＋追加
      </button>
      {open && (
        <Popover label="パターンを追加" onClose={close}>
          {pattern === null ? (
            <div class="flex w-56 flex-wrap gap-1">
              {EXTRA_PATTERNS.map((p, i) => (
                <button key={p} type="button" disabled={taken.has(p)} class={`rounded border px-2 py-1 font-mono disabled:opacity-30 ${i < 2 ? "border-slate-500" : "border-slate-200 text-xs text-slate-500"}`} onClick={() => setPattern(p)}>
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <MemoryEditor pattern={pattern} onSubmit={submit} />
          )}
          {refused !== null && <p role="alert" class="mt-1 text-xs text-rose-600">{refused}</p>}
        </Popover>
      )}
    </div>
  );
}

/** The 追加 area: the row's extra groups with their patterns above them, and 「＋追加」 while there is room. */
export function ExtrasArea({ row }: { row: Row }) {
  return (
    <div class="flex items-start gap-[var(--group-gap)]">
      {row.extras.map((group) => (
        <div key={group.pattern} class="flex flex-col">
          <ExtraLabels pattern={group.pattern} />
          <GroupView row={row} pattern={group.pattern} memories={group.memories} />
        </div>
      ))}
      {row.extras.length < MAX_EXTRAS && <AddExtra row={row} />}
    </div>
  );
}
