import { useState } from "preact/hooks";
import { type Memory, type Pattern, type Tier, TIERS } from "../memo/types.ts";
import { CELL_VALUES, kindsOf } from "../memo/values.ts";
import { STATS, TIER_LABELS } from "./labels.ts";
import { ArmedButton } from "./Popover.tsx";

/** The memory, once all three tiers are chosen. */
function complete(tiers: readonly (Tier | null)[]): Memory | null {
  const [vo, da, vi] = tiers;
  return vo && da && vi ? [vo, da, vi] : null;
}

/**
 * The memory popover's contents (D18): a line each for Vo, Da and Vi with ◆ダイヤ and 虹, each
 * showing the value it means. A new memory starts with nothing chosen and 追加 waits for all three,
 * so a half-filled memory cannot exist; an owned one starts with its tiers and offers 削除.
 */
export function MemoryEditor({
  pattern,
  initial,
  onSubmit,
  onDelete,
}: {
  pattern: Pattern;
  initial?: Memory;
  onSubmit: (memory: Memory) => void;
  onDelete?: () => void;
}) {
  const [tiers, setTiers] = useState<(Tier | null)[]>(initial ? [...initial] : [null, null, null]);
  const kinds = kindsOf(pattern);
  const memory = complete(tiers);
  return (
    <div class="flex w-64 flex-col gap-2">
      {STATS.map((stat, i) => (
        <div key={stat.name} class="flex items-center gap-2">
          <span class="w-6 border-t-[3px] text-xs font-bold" style={{ borderColor: stat.color }}>
            {stat.name}
          </span>
          {TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              aria-pressed={tiers[i] === tier}
              class={`tier-${tier} flex-1 rounded py-2 text-sm ${tiers[i] === tier ? "font-bold ring-2 ring-slate-800" : "opacity-60"}`}
              onClick={() => setTiers(tiers.with(i, tier))}
            >
              {TIER_LABELS[tier]} {CELL_VALUES[kinds[i] ?? "%"][tier]}
            </button>
          ))}
        </div>
      ))}
      <div class="flex items-center justify-between gap-2">
        {onDelete ? <ArmedButton label="削除" armedLabel="もう一度押すと削除" onConfirm={onDelete} /> : <span />}
        <button type="button" disabled={memory === null} class="rounded bg-slate-800 px-4 py-1.5 text-white disabled:opacity-30" onClick={() => memory && onSubmit(memory)}>
          {initial ? "変更" : "追加"}
        </button>
      </div>
    </div>
  );
}
