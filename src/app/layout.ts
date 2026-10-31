/**
 * Geometry the page computes from measured boxes, kept pure so it is tested without a layout
 * engine (happy-dom has none): where a dragged row lands (D14) and where an in-place popover sits
 * so it stays on screen (D18, D19).
 */

/**
 * Where a dragged row lands among the section's other rows, as `reorderRow` takes it: how many of
 * those rows' vertical midpoints lie above the pointer.
 */
export function dropIndex(pointerY: number, midpoints: readonly number[]): number {
  return midpoints.filter((mid) => mid < pointerY).length;
}

/**
 * The drop place among all the section's other rows, from the place among those shown: before the
 * shown row at `shownIndex`, or just after the last shown row when it is past them. Only the
 * dragged row moves: every other row, shown or hidden by 「未所持がある行だけ表示」, keeps its order
 * (D50), rather than hidden rows keeping their indices, which would make shown rows jump across them.
 */
export function placeAmongAll(others: readonly string[], shownOthers: readonly string[], shownIndex: number): number {
  const before = shownOthers[shownIndex];
  if (before !== undefined) return others.indexOf(before);
  const last = shownOthers.at(-1);
  return last === undefined ? others.length : others.indexOf(last) + 1;
}

/** Space kept between a popover and the edge of the screen. */
export const SCREEN_MARGIN = 8;

/**
 * How far right of its anchor's left edge a popover starts: 0 when it fits there, else as little
 * as keeps it on screen, and at the left margin when it is wider than the screen.
 */
export function popoverOffset(anchorLeft: number, width: number, viewportWidth: number, margin = SCREEN_MARGIN): number {
  const leftmost = margin - anchorLeft;
  const rightmost = viewportWidth - margin - width - anchorLeft;
  return Math.max(leftmost, Math.min(0, rightmost));
}
