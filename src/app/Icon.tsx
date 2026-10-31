import type { PlanId } from "../memo/types.ts";
import { usePage } from "./page.ts";
import { type Art, iconCell, spriteStyle } from "./sheets.ts";

/**
 * A skill card's icon, a cell of the tab's sprite sheet in the art of 「カードの絵柄」 (D20, D42), at
 * `size` (a CSS length). Where the sheets lack it, or the card is unknown (D31), its name is drawn
 * in a grey box instead.
 */
export function CardIcon({ art, plan, size, name }: { art: Art | undefined; plan: PlanId; size: string; name: string }) {
  const { sheets, idol, defaultIdol } = usePage();
  const cell = art === undefined ? null : iconCell(sheets, plan, art, idol, defaultIdol);
  if (cell === null) {
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
  return <span role="img" aria-label={name} class="inline-block shrink-0 rounded bg-no-repeat" style={spriteStyle(cell, size)} />;
}
