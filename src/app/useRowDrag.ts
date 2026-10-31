import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import { reorderRow } from "../memo/edit.ts";
import type { Row } from "../memo/types.ts";
import { dropIndex, placeAmongAll } from "./layout.ts";
import { usePage } from "./page.ts";
import type { HandleProps } from "./RowView.tsx";

/** The row being dragged and where among the shown other rows it would land. */
export interface Drag {
  id: string;
  over: number;
}

type HandleEvent = JSX.TargetedPointerEvent<HTMLButtonElement>;

/**
 * Dragging a row by its handle within its section (D14), with pointer events so it works by touch:
 * the handle captures the pointer, each move measures the other rows' middles to draw the drop
 * line, and the release measures them again at its own position, so a release that comes before
 * the last move was drawn still lands where the finger is. Only the dragged row moves (D53). Losing
 * the pointer capture ends the drag.
 */
export function useRowDrag(rows: readonly Row[], shown: readonly Row[]) {
  const { memo, setMemo } = usePage();
  const list = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const middlesExcept = (id: string): number[] =>
    [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])]
      .filter((el) => el.dataset["row"] !== id)
      .map((el) => {
        const box = el.getBoundingClientRect();
        return box.top + box.height / 2;
      });
  const drop = (id: string, over: number) => {
    const others = rows.filter((r) => r.id !== id).map((r) => r.id);
    const shownOthers = shown.filter((r) => r.id !== id).map((r) => r.id);
    setMemo(reorderRow(memo, id, placeAmongAll(others, shownOthers, over)));
  };
  const handle = (row: Row, shownIndex: number): HandleProps => ({
    onPointerDown: (e: HandleEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id: row.id, over: shownIndex });
    },
    onPointerMove: (e: HandleEvent) => {
      if (drag?.id === row.id) setDrag({ id: row.id, over: dropIndex(e.clientY, middlesExcept(row.id)) });
    },
    onPointerUp: (e: HandleEvent) => {
      if (drag?.id === row.id) drop(row.id, dropIndex(e.clientY, middlesExcept(row.id)));
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onLostPointerCapture: () => setDrag(null),
  });
  return { list, drag, handle };
}
