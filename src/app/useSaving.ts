import { useEffect, useRef } from "preact/hooks";
import type { Memo } from "../memo/types.ts";
import type { Reread, Saving, Settings } from "./storage.ts";

/** What the page shows that is saved: the memo, the idol of 「カードの絵柄」 and the counting switch. */
export interface Shown {
  memo: Memo;
  idol: string;
  counting: boolean;
}

/** How the page takes what another tab saved (#29). */
export interface Follow {
  setMemo: (memo: Memo) => void;
  setIdol: (idol: string) => void;
  setCounting: (counting: boolean) => void;
  /** The idol the page shows for a saved one: null, or one the data file lacks, is the first idol (D34). */
  idolFor: (saved: string | null) => string;
}

/**
 * What of a reread the page takes: nothing of a part the player changed while the store was read,
 * since that change is about to be saved over what was read (`before` is what the page showed when
 * the read began, `now` what it shows when the read ends).
 */
export function takeable(found: Reread, before: Shown, now: Shown): Reread {
  const taken: Reread = {};
  if (found.memo !== undefined && now.memo === before.memo) taken.memo = found.memo;
  if (found.settings !== undefined && now.idol === before.idol && now.counting === before.counting) taken.settings = found.settings;
  return taken;
}

/** Saves each change the page makes, and none it took from the store, which `last` already holds. */
function useSaveChanges(save: Saving, shown: Shown, last: { current: Shown }): void {
  const { memo, idol, counting } = shown;
  useEffect(() => {
    const was = last.current;
    if (was.memo !== memo) save.memo(memo);
    if (was.idol !== idol || was.counting !== counting) save.settings({ idol, counting } satisfies Settings);
    last.current = { memo, idol, counting };
  }, [save, memo, idol, counting, last]);
}

interface Refs {
  /** What the store holds as far as the page knows. */
  last: { current: Shown };
  /** What the page shows: its last render, or what a reread took since. */
  current: { current: Shown };
  following: { current: Follow };
}

/**
 * One reread: takes what another tab saved, unless the page changed meanwhile (`takeable`). What it
 * takes is recorded at once, before the page renders it, so a reread queued behind this one compares
 * with it rather than with what the page showed before (Codex's review of #29).
 */
function rereadOnce(save: Saving, refs: Refs): Promise<void> {
  const before = refs.current.current;
  return save.reread().then(
    (found) => {
      const taken = takeable(found, before, refs.current.current);
      const page = refs.following.current;
      if (taken.memo !== undefined) {
        refs.last.current = { ...refs.last.current, memo: taken.memo };
        refs.current.current = { ...refs.current.current, memo: taken.memo };
        page.setMemo(taken.memo);
      }
      if (taken.settings !== undefined) {
        const settings = { idol: page.idolFor(taken.settings.idol), counting: taken.settings.counting };
        refs.last.current = { ...refs.last.current, ...settings };
        refs.current.current = { ...refs.current.current, ...settings };
        page.setIdol(settings.idol);
        page.setCounting(settings.counting);
      }
    },
    (error: unknown) => console.error("the saved memo was not read again:", error),
  );
}

/**
 * Saves the memo and the settings after each change (D16, D57), not the ones the page started from,
 * and writes a memo still waiting as soon as the page is hidden or left: a phone may close a hidden
 * page without another word. What another tab saves is taken when that tab says it wrote, and when
 * the page is shown again, since a phone may pause a hidden tab past the message (#29).
 */
export function useSaving(save: Saving, shown: Shown, follow: Follow): void {
  // What the store holds as far as this page knows; a render that differs from it is a change to save.
  const last = useRef(shown);
  const current = useRef(shown);
  current.current = shown;
  const following = useRef(follow);
  following.current = follow;
  useSaveChanges(save, shown, last);
  // Rereads one after another, each taking what the page shows as its turn starts (Codex's review of #29).
  const rereads = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const reread = (): void => {
      rereads.current = rereads.current.then(() => rereadOnce(save, { last, current, following }));
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") void save.flush();
      else reread();
    };
    const flush = (): void => void save.flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    const stopListening = save.listen(reread);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      stopListening();
    };
  }, [save]);
}
