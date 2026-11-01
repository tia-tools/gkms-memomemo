import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { decodeMemo, isCodeRefusal } from "../memo/code.ts";
import type { Memo } from "../memo/types.ts";
import { codeInFragment, codeRefusalText } from "./transfer.ts";

/** Where a code came from: a link's fragment, or the paste box in the footer. Each is answered where it was given. */
export type ImportFrom = "link" | "paste";

export type ImportState =
  | { stage: "refused"; from: ImportFrom; text: string }
  | { stage: "confirm"; from: ImportFrom; memo: Memo }
  | { stage: "done"; from: ImportFrom; before: Memo; after: Memo };

export interface Importing {
  /** What to show, or null; an undo the memo has moved on from is not shown. */
  state: ImportState | null;
  offer: (code: string, from: ImportFrom) => void;
  accept: () => void;
  undo: () => void;
  dismiss: () => void;
}

/**
 * Importing a 引き継ぎコード (D16, D59): a code is decoded, then the player confirms; the import
 * replaces the memo, never merges, and the memo it replaced is kept for an undo. The undo is offered
 * only while the memo is still what the import made, so it never throws away a later change (as D50
 * had it for the sort); any change withdraws it. A later code replaces one still being decoded.
 */
export function useImport(memo: Memo, setMemo: (memo: Memo) => void): Importing {
  const [state, setState] = useState<ImportState | null>(null);
  const latest = useRef(0);
  const offer = useCallback((code: string, from: ImportFrom) => {
    latest.current += 1;
    const mine = latest.current;
    void decodeMemo(code).then((result) => {
      if (mine !== latest.current) return;
      if (!isCodeRefusal(result)) return setState({ stage: "confirm", from, memo: result });
      if (result.detail !== undefined) console.error("the code's memo was not read:", result.detail);
      setState({ stage: "refused", from, text: codeRefusalText(result) });
    });
  }, []);
  const shown = state?.stage === "done" && state.after !== memo ? null : state;
  return {
    state: shown,
    offer,
    accept: () => {
      if (shown?.stage !== "confirm") return;
      setState({ stage: "done", from: shown.from, before: memo, after: shown.memo });
      setMemo(shown.memo);
    },
    undo: () => {
      if (shown?.stage !== "done") return;
      setMemo(shown.before);
      setState(null);
    },
    dismiss: () => {
      latest.current += 1;
      setState(null);
    },
  };
}

/**
 * Offers the code a link carries (D28): at start and whenever the fragment changes. The fragment is
 * taken out of the address bar at once, so a reload does not offer the code again.
 */
export function useLinkImport(offer: (code: string, from: ImportFrom) => void): void {
  useEffect(() => {
    const read = (): void => {
      const code = codeInFragment(location.hash);
      if (code === null) return;
      history.replaceState(history.state, "", location.pathname + location.search);
      offer(code, "link");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [offer]);
}
