import { type ComponentChildren, createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { popoverOffset, popoverPlace, type ScreenPoint } from "./layout.ts";

/**
 * The page's popover layer (#69): a box at the page's top left, outside every scrolling row, into
 * which popovers are drawn so a section's rows scrolled sideways cannot clip them. Without one (a
 * part rendered on its own) a popover is drawn inside its anchor.
 */
export const PopoverLayer = createContext<HTMLElement | null>(null);

/** The page's contents, with the popover layer at their top left for the popovers among them. */
export function PopoverLayerRoot({ children }: { children: ComponentChildren }) {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  return (
    <PopoverLayer.Provider value={layer}>
      <div class="relative">
        <div ref={setLayer} class="absolute top-0 left-0" />
        {children}
      </div>
    </PopoverLayer.Provider>
  );
}

/** Closes on Escape while mounted. */
function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/**
 * Renders the component again whenever the window is resized or the phone turned, or anything
 * scrolls: a section's rows scrolled sideways move the anchor (#69). Scroll events do not bubble,
 * so the window listens for them in the capture phase.
 */
function useRenderOnMove(): void {
  const [, setMoves] = useState(0);
  useEffect(() => {
    const onMove = (): void => setMoves((n) => n + 1);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, []);
}

/** Where the panel sits: in the layer's coordinates, or, with no layer, beside its anchor (top null: under it by CSS). */
type Place = { left: number; top: number | null };

function placeOf(anchor: HTMLElement, panel: HTMLElement, layer: HTMLElement | null): Place {
  const box = anchor.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth;
  if (layer === null) return { left: popoverOffset(box.left, panel.offsetWidth, viewport), top: null };
  const origin: ScreenPoint = layer.getBoundingClientRect();
  return popoverPlace(box, origin, panel.offsetWidth, viewport);
}

/**
 * An in-place popover, not a bottom sheet (D18, D19): under its anchor (the `relative` box it is
 * rendered in), moved sideways as little as keeps it on screen, and drawn in the page's popover
 * layer (#69). A tap outside it or Escape closes it.
 */
export function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: ComponentChildren }) {
  const layer = useContext(PopoverLayer);
  const marker = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>({ left: 0, top: null });
  useRenderOnMove();
  // Measured after every render, since a popover's steps change its width, and a resize or a turn
  // of the phone or a scroll renders it again; set only when it moved.
  useLayoutEffect(() => {
    const anchor = marker.current?.parentElement;
    if (!panel.current || !anchor) return;
    const next = placeOf(anchor, panel.current, layer);
    if (next.left !== place.left || next.top !== place.top) setPlace(next);
  });
  useEscape(onClose);
  const drawn = (
    <>
      <div class="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        class={`panel absolute z-50 mt-1 max-w-[calc(100vw-16px)] p-2 text-sm shadow-lg ${place.top === null ? "top-full" : ""}`}
        style={{ left: `${place.left}px`, top: place.top === null ? undefined : `${place.top}px` }}
      >
        {children}
      </div>
    </>
  );
  return (
    <>
      <span ref={marker} data-popover-anchor hidden />
      {layer === null ? drawn : createPortal(drawn, layer)}
    </>
  );
}

/** How long an armed delete waits for its second tap. */
export const ARMED_MS = 3000;

/**
 * A delete that takes two taps (D4, D19): the first arms it, with a visible shake and its armed
 * label (for a row, how many memories go with it); the second deletes. Left alone, it disarms.
 */
export function ArmedButton({ label, armedLabel, onConfirm }: { label: string; armedLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button type="button" class={`btn btn-danger px-3 py-1.5 ${armed ? "armed" : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? armedLabel : label}
    </button>
  );
}
