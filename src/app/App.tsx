import { useEffect, useMemo, useState } from "preact/hooks";
import type { SkillCardDataFile } from "../data/contract.ts";
import { makeCatalog } from "./catalog.ts";
import { MemoPage } from "./MemoPage.tsx";
import { bundledIcons } from "./sheets.ts";

type SkillCards = { status: "loading" } | { status: "ready"; data: SkillCardDataFile } | { status: "failed" };

/**
 * The page (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 4): the title, then the memo once the skill
 * card file has loaded. The icons' index is bundled with the page (docs/plans/
 * EXECPLAN_GAME_STYLE_ICONS.md, I3), so only the card file is fetched; `load` gets it
 * (src/data/load.ts in the page), passed in so a test needs no network.
 */
export function App({ load }: { load: () => Promise<SkillCardDataFile> }) {
  const [state, setState] = useState<SkillCards>({ status: "loading" });
  const sheets = useMemo(() => bundledIcons(), []);
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
  const catalog = useMemo(() => (state.status === "ready" ? makeCatalog(state.data) : null), [state]);
  return (
    <main class="mx-auto max-w-5xl px-1 py-3 min-[600px]:px-3">
      <h1 class="text-lg font-bold">学マス　メモリーメモ帳</h1>
      {catalog && <MemoPage catalog={catalog} sheets={sheets} />}
      {state.status === "failed" && <p class="text-sm text-rose-600">カードデータを読み込めませんでした</p>}
    </main>
  );
}
