/**
 * What every part of the page reads: the data, the icons, the chosen art, the memo and the ways to
 * change it (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 4). One context rather than props
 * through every level; MemoPage.tsx provides it.
 */

import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Memo } from "../memo/types.ts";
import type { Catalog } from "./catalog.ts";
import type { SheetIndex } from "./sheets.ts";

export interface Page {
  catalog: Catalog;
  sheets: SheetIndex;
  /** The idol of 「カードの絵柄」 (D20), and the one whose art stands in when that idol has none (D34). */
  idol: string;
  defaultIdol: string;
  memo: Memo;
  /** Replaces the memo with an edit's result (src/memo/edit.ts). */
  setMemo: (memo: Memo) => void;
  /** Shows the row: its tab, scrolled to and highlighted (D9, D13). */
  jumpTo: (rowId: string) => void;
  /** The row highlighted after a jump, or null. */
  highlighted: string | null;
}

export const PageContext = createContext<Page | null>(null);

export function usePage(): Page {
  const page = useContext(PageContext);
  if (page === null) throw new Error("usePage outside MemoPage");
  return page;
}
