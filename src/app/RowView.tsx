import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { deleteRow, isRefusal, moveRow } from "../memo/edit.ts";
import { FIXED_PATTERNS, planOf, type PlanId, type Row, type SectionId, sectionsOf } from "../memo/types.ts";
import { customizationLabels } from "./catalog.ts";
import { ExtrasArea, GroupView } from "./Group.tsx";
import { CardIcon } from "./Icon.tsx";
import { SECTION_LABELS } from "./labels.ts";
import { usePage } from "./page.ts";
import { ArmedButton, Popover } from "./Popover.tsx";
import { RowPopover } from "./RowPopover.tsx";

/** The pointer handlers of a row's drag handle (useRowDrag.ts). */
export type HandleProps = Pick<JSX.HTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture">;

/** How many memories the row holds, which its delete names (D19). */
export function memoryCount(row: Row): number {
  return FIXED_PATTERNS.reduce((n, p) => n + row.fixed[p].length, 0) + row.extras.reduce((n, g) => n + g.memories.length, 0);
}

/** The card column (D1, D31): the card, its name, and under it the H.I.F. ability, then the customization and 開幕時獲得. */
function CardCell({ row, plan }: { row: Row; plan: PlanId }) {
  const { catalog } = usePage();
  const card = catalog.card(row.build.card, row.build.upgrade);
  const hif = catalog.hif(row.build.hif);
  const name = card?.name ?? "不明なカード";
  const labels = customizationLabels(card, row.build.customization);
  return (
    <div class="flex w-[var(--card-col)] shrink-0 flex-col gap-0.5">
      <CardIcon card={card} plan={plan} size="var(--icon)" name={name} />
      <span class="text-[10px] leading-tight break-all">{name}</span>
      <CardIcon card={hif?.card} plan={plan} size="var(--hif-icon)" name={hif ? `HIF ${hif.card.name}` : "不明なHIF"} />
      <div class="flex flex-col text-[length:var(--label-font)] leading-tight break-all">
        {labels.length === 0 ? (
          <span class="text-slate-400">なし</span>
        ) : (
          labels.map(({ label, times }, i) => (
            <span key={i}>
              {label}
              {times && (
                <>
                  {" "}
                  <span class="whitespace-nowrap">{times}</span>
                </>
              )}
            </span>
          ))
        )}
        {row.build.kaimaku && <span class="text-emerald-700">開幕時獲得</span>}
      </div>
    </div>
  );
}

/** 「⋯」: 変更, 別のセクションへ移動 and the two-tap 行を削除 (D19). */
function RowMenu({ row, section, onChange, onClose }: { row: Row; section: SectionId; onChange: () => void; onClose: () => void }) {
  const { memo, setMemo } = usePage();
  const memories = memoryCount(row);
  const move = (to: SectionId) => {
    const result = moveRow(memo, row.id, to);
    if (!isRefusal(result)) setMemo(result);
    onClose();
  };
  return (
    <Popover label="行のメニュー" onClose={onClose}>
      <div class="flex w-48 flex-col gap-1.5">
        <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-left" onClick={onChange}>
          変更
        </button>
        <span class="text-xs text-slate-500">別のセクションへ移動</span>
        <div class="flex gap-1">
          {sectionsOf(planOf(section))
            .filter((s) => s !== section)
            .map((s) => (
              <button key={s} type="button" class="flex-1 rounded border border-slate-300 px-2 py-1.5" onClick={() => move(s)}>
                {SECTION_LABELS[s]}
              </button>
            ))}
        </div>
        <ArmedButton label="行を削除" armedLabel={memories > 0 ? `メモリー${memories}件も削除` : "もう一度押すと削除"} onConfirm={() => setMemo(deleteRow(memo, row.id))} />
      </div>
    </Popover>
  );
}

/** The drag handle and 「⋯」, in a narrow strip left of the card. */
function RowControls({ row, section, plan, handle }: { row: Row; section: SectionId; plan: PlanId; handle: HandleProps }) {
  const [open, setOpen] = useState<"menu" | "change" | null>(null);
  const close = () => setOpen(null);
  return (
    <div class="relative flex w-[var(--controls)] shrink-0 flex-col items-center gap-2 pt-1 text-slate-400">
      <button type="button" aria-label="並べ替えのハンドル" class="cursor-grab touch-none px-0.5 leading-none select-none" {...handle}>
        ⋮⋮
      </button>
      <button type="button" aria-label="行のメニュー" class="px-0.5 leading-none" onClick={() => setOpen("menu")}>
        ⋯
      </button>
      {open === "menu" && <RowMenu row={row} section={section} onChange={() => setOpen("change")} onClose={close} />}
      {open === "change" && <RowPopover plan={plan} section={section} row={row} onClose={close} />}
    </div>
  );
}

/**
 * One row (D1): the card column, the three fixed groups in %%F, %F%, F%% order, and the 追加 area,
 * which moves to a line of its own under the groups on a phone (D17).
 */
export function RowView({ row, section, plan, handle, dragging }: { row: Row; section: SectionId; plan: PlanId; handle: HandleProps; dragging: boolean }) {
  const { highlighted } = usePage();
  return (
    <div
      id={`row-${row.id}`}
      data-row={row.id}
      class={`flex items-start gap-x-[var(--group-gap)] border-b border-slate-100 py-1.5 ${highlighted === row.id ? "highlight" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <RowControls row={row} section={section} plan={plan} handle={handle} />
      <CardCell row={row} plan={plan} />
      <div class="flex flex-1 flex-wrap items-start gap-x-[var(--group-gap)] gap-y-1">
        {FIXED_PATTERNS.map((p) => (
          <GroupView key={p} row={row} pattern={p} memories={row.fixed[p]} />
        ))}
        <div class="basis-full min-[600px]:basis-auto">
          <ExtrasArea row={row} />
        </div>
      </div>
    </div>
  );
}
