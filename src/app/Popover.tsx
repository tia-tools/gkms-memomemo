import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { popoverOffset } from "./layout.ts";

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

/** Renders the component again whenever the window is resized or the phone turned. */
function useRenderOnResize(): void {
  const [, setResizes] = useState(0);
  useEffect(() => {
    const onResize = (): void => setResizes((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
}

/**
 * An in-place popover, not a bottom sheet (D18, D19): rendered inside its anchor's `relative` box,
 * below it, and moved sideways as little as keeps it on screen. A tap outside it or Escape closes it.
 */
export function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);
  useRenderOnResize();
  // Measured after every render, since a popover's steps change its width, and a resize or a turn
  // of the phone renders it again; set only when it moved.
  useLayoutEffect(() => {
    const anchor = panel.current?.parentElement;
    if (!panel.current || !anchor) return;
    const offset = popoverOffset(anchor.getBoundingClientRect().left, panel.current.offsetWidth, document.documentElement.clientWidth);
    if (offset !== left) setLeft(offset);
  });
  useEscape(onClose);
  return (
    <>
      <div class="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        class="absolute top-full z-50 mt-1 max-w-[calc(100vw-16px)] rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg"
        style={{ left: `${left}px` }}
      >
        {children}
      </div>
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
  const look = armed ? "armed border-rose-600 bg-rose-600 text-white" : "border-rose-300 text-rose-600";
  return (
    <button type="button" class={`rounded border px-3 py-1.5 ${look}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? armedLabel : label}
    </button>
  );
}
