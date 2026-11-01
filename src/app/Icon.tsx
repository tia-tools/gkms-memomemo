import type { SkillCard } from "../data/contract.ts";
import type { PlanId } from "../memo/types.ts";
import { usePage } from "./page.ts";
import { frameCell, iconCell, spriteStyle } from "./sheets.ts";

/**
 * A skill card's icon at its level as the game draws it, a cell of the tab's sheet in the art of
 * 「カードの絵柄」 (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I2), at `size` (a CSS length). A card
 * the sheets lack is drawn as the empty frame of its rarity and type with its name inside (I5); an
 * unknown card (D31 of the memo plan) as its name in a grey box.
 */
export function CardIcon({ card, plan, size, name }: { card: SkillCard | undefined; plan: PlanId; size: string; name: string }) {
  const { sheets, idol, defaultIdol } = usePage();
  const cell = card === undefined ? null : iconCell(sheets, plan, card, idol, defaultIdol);
  if (cell !== null) return <span role="img" aria-label={name} class="inline-block shrink-0 rounded bg-no-repeat" style={spriteStyle(cell, size)} />;
  const frame = card === undefined ? null : frameCell(card.rarity, card.type);
  if (frame !== null) {
    return (
      <span
        role="img"
        aria-label={name}
        class="flex shrink-0 items-center justify-center overflow-hidden rounded bg-no-repeat p-[18%] text-center text-[8px] leading-tight break-all text-slate-600"
        style={spriteStyle(frame, size)}
      >
        {name}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      class="flex shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200 p-0.5 text-center text-[9px] leading-tight break-all text-slate-600"
      style={{ width: size, height: size }}
    >
      {name}
    </span>
  );
}
