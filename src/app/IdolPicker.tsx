import { useState } from "preact/hooks";
import type { Idol } from "../data/pool.ts";
import { faceUrl, fallbackGlyph } from "./idols.ts";

/**
 * An idol's SD face in a white circle at `size` (a CSS length), from the library's address (L6), or
 * the first character of her name when the face cannot be had. `crossOrigin` makes the request a
 * CORS one, so the service worker gets an answer it can read and keep, not an opaque one. Give it a
 * `key` of the idol's id, so a face that failed for one idol is not taken as failed for the next.
 */
function Face({ idol, size }: { idol: Idol; size: string }) {
  const [missing, setMissing] = useState(false);
  const url = faceUrl(idol.id);
  if (url !== null && !missing) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
        decoding="async"
        class="inline-block shrink-0 rounded-full border border-slate-200 bg-white object-contain"
        style={{ width: size, height: size }}
        onError={() => setMissing(true)}
      />
    );
  }
  return (
    <span aria-hidden="true" class="flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600" style={{ width: size, height: size }}>
      {fallbackGlyph(idol.name)}
    </span>
  );
}

/**
 * 「カードの絵柄」, the idol every card icon is drawn in (D20, D34), above the 早見表 (#14), chosen
 * from the idols' faces (docs/plans/EXECPLAN_IDOL_ICON_TABLE.md, T3; loaded from the library since
 * docs/plans/EXECPLAN_LIBRARY_DATA.md, L6): folded, one button with the
 * chosen idol's face and name; unfolded, every idol's face, seven to a line, the chosen one ringed.
 * Choosing folds it again.
 */
export function IdolPicker({ idols, idol, onIdol }: { idols: readonly Idol[]; idol: string; onIdol: (idol: string) => void }) {
  const [open, setOpen] = useState(false);
  const chosen = idols.find((i) => i.id === idol);
  return (
    <div class="flex flex-col gap-2 text-sm">
      <button type="button" class="btn flex w-fit items-center gap-2 py-1 pr-3 pl-2" aria-expanded={open} onClick={() => setOpen(!open)}>
        カードの絵柄
        {chosen !== undefined && <Face key={chosen.id} idol={chosen} size="2rem" />}
        {chosen?.name}
      </button>
      {open && (
        <div role="group" aria-label="カードの絵柄" class="grid w-fit grid-cols-[repeat(7,3rem)] gap-1">
          {idols.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-label={i.name}
              title={i.name}
              aria-pressed={i.id === idol}
              class={`rounded-full p-0 ${i.id === idol ? "ring-2 ring-pink-500 ring-offset-1" : ""}`}
              onClick={() => {
                onIdol(i.id);
                setOpen(false);
              }}
            >
              <Face idol={i} size="3rem" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
