import { useEffect, useMemo, useState } from "preact/hooks";
import type { SkillCardDataFile } from "../data/contract.ts";
import { makeCatalog } from "./catalog.ts";
import { MemoPage } from "./MemoPage.tsx";
import { NO_SHEETS, type SheetIndex } from "./sheets.ts";

type SkillCards = { status: "loading" } | { status: "ready"; data: SkillCardDataFile } | { status: "failed" };

/**
 * The page (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 4): the title, then the memo once the skill
 * card file has loaded. The sprite sheet index loads beside it; until it arrives, or if it cannot,
 * every icon is drawn as its card's name (D42). `load` and `loadSheets` get the two files
 * (src/data/load.ts and src/app/sheets.ts in the page), passed in so a test needs no network.
 */
export function App({ load, loadSheets }: { load: () => Promise<SkillCardDataFile>; loadSheets: () => Promise<SheetIndex> }) {
  const [state, setState] = useState<SkillCards>({ status: "loading" });
  const [sheets, setSheets] = useState<SheetIndex>(NO_SHEETS);
  useEffect(() => {
    load().then(
      (data) => setState({ status: "ready", data }),
      (error: unknown) => {
        // The loader's message names the first bad value; the console is where to read it.
        console.error(error);
        setState({ status: "failed" });
      },
    );
  }, [load]);
  useEffect(() => {
    loadSheets().then(setSheets, (error: unknown) => console.warn("icons drawn as names:", error));
  }, [loadSheets]);
  const catalog = useMemo(() => (state.status === "ready" ? makeCatalog(state.data) : null), [state]);
  return (
    <main class="mx-auto max-w-5xl px-3 py-3">
      <h1 class="text-lg font-bold">学マス　メモリーメモ帳</h1>
      {catalog && <MemoPage catalog={catalog} sheets={sheets} />}
      {state.status === "failed" && <p class="text-sm text-rose-600">カードデータを読み込めませんでした</p>}
    </main>
  );
}
