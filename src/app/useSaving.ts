import { useEffect, useMemo, useRef } from "preact/hooks";
import type { Memo } from "../memo/types.ts";
import type { Saving, Settings } from "./storage.ts";

/** Calls `onChange` after a render whose `value` is not the previous render's, never for the first. */
function useOnChange<T>(value: T, onChange: (value: T) => void): void {
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    onChange(value);
  }, [value, onChange]);
}

/**
 * Saves the memo and the settings after each change (D16, D57), not the ones the page started from,
 * and writes a memo still waiting as soon as the page is hidden or left: a phone may close a hidden
 * page without another word.
 */
export function useSaving(save: Saving, memo: Memo, idol: string, counting: boolean): void {
  const settings = useMemo<Settings>(() => ({ idol, counting }), [idol, counting]);
  useOnChange(memo, save.memo);
  useOnChange(settings, save.settings);
  useEffect(() => {
    const flushIfHidden = (): void => {
      if (document.visibilityState === "hidden") void save.flush();
    };
    const flush = (): void => void save.flush();
    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [save]);
}
