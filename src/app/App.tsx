import { useEffect, useState } from "preact/hooks";
import type { SkillCardDataFile } from "../data/contract.ts";

type SkillCards = { status: "loading" } | { status: "ready"; data: SkillCardDataFile } | { status: "failed" };

/**
 * Placeholder page of Milestone 2 (docs/plans/EXECPLAN_MEMORY_MEMO.md): the title and how many
 * entries the skill card file holds, until Milestone 4 builds the memo. `load` gets the file
 * (src/data/load.ts `loadSkillCardData` in the page), passed in so a test needs no network.
 */
export function App({ load }: { load: () => Promise<SkillCardDataFile> }) {
  const [state, setState] = useState<SkillCards>({ status: "loading" });
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
  return (
    <main class="mx-auto max-w-3xl p-4">
      <h1 class="text-lg font-bold">学マス　メモリーメモ帳</h1>
      {state.status === "ready" && <p class="text-sm">スキルカード {state.data.cards.length} 件</p>}
      {state.status === "failed" && <p class="text-sm text-rose-600">カードデータを読み込めませんでした</p>}
    </main>
  );
}
