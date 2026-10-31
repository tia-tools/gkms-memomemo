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
