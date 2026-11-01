import { useEffect, useMemo, useState } from "preact/hooks";
import type { SkillCardDataFile } from "../data/contract.ts";
import { makeCatalog } from "./catalog.ts";
import { type CountsApi, NO_COUNTS } from "./counts.ts";
import { MemoPage } from "./MemoPage.tsx";
import { bundledIcons } from "./sheets.ts";
import { NOT_SAVING, type Notice, openSaved, type PersistentStorage, SAVE_DELAY_MS, type Saved, type Saving, saving, type Store } from "./storage.ts";

type Start = { status: "loading" } | { status: "ready"; data: SkillCardDataFile; saved: Saved; save: Saving } | { status: "failed" };

/** What the page says about saving (D57), above the memo. */
export const NOTICE_TEXT: Record<Notice, string> = {
  unavailable: "このブラウザではメモを保存できません。閉じる前に引き継ぎコードで控えを取ってください。",
  unreadable: "保存されていたメモを読み込めなかったので、空のメモから始めます。元のメモは消さずに別に残してあります。",
  "save-failed": "メモを保存できませんでした。引き継ぎコードで控えを取ってください。",
};

/**
 * The page (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestones 4 and 5): the title, then the memo once
 * the skill card file has loaded and the saved memo has been read. The icons' index is bundled with
 * the page (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I3), so only the card file is fetched. What
 * reaches outside the page is passed in, so a test needs no network and no IndexedDB: `load` gets
 * the card file (src/data/load.ts), `openStore` the browser's store (src/app/idb.ts), and `storage`
 * is `navigator.storage`, asked to keep it (src/app/storage.ts), and `countsApi` the Worker's counts
 * (src/app/counts.ts).
 */
export function App({
  load,
  openStore,
  storage,
  countsApi = NO_COUNTS,
}: {
  load: () => Promise<SkillCardDataFile>;
  openStore: () => Promise<Store>;
  storage?: PersistentStorage;
  countsApi?: CountsApi;
}) {
  const [state, setState] = useState<Start>({ status: "loading" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const sheets = useMemo(() => bundledIcons(), []);
  useEffect(() => {
    const onError = (error: unknown): void => {
      console.error("the memo was not saved:", error);
      setNotice("save-failed");
    };
    // openSaved never rejects: a store that cannot be used is a page that saves nothing, and says so.
    Promise.all([load(), openSaved(openStore, () => new Date())]).then(
      ([data, { saved, store }]) => {
        setNotice(saved.notice);
        const save = store === null ? NOT_SAVING : saving(store, { delayMs: SAVE_DELAY_MS, onError, storage });
        setState({ status: "ready", data, saved, save });
      },
      (error: unknown) => {
        // The loader's message names the first bad value; the console is where to read it.
        console.error(error);
        setState({ status: "failed" });
      },
    );
  }, [load, openStore, storage]);
  const catalog = useMemo(() => (state.status === "ready" ? makeCatalog(state.data) : null), [state]);
  return (
    <main class="mx-auto max-w-5xl px-1 py-3 min-[600px]:px-3">
      <h1 class="text-lg font-bold">学マス　メモリーメモ帳</h1>
      {notice !== null && (
        <p role="alert" class="my-2 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">
          {NOTICE_TEXT[notice]}
        </p>
      )}
      {catalog && state.status === "ready" && <MemoPage catalog={catalog} sheets={sheets} initial={state.saved.memo} settings={state.saved.settings} save={state.save} countsApi={countsApi} />}
      {state.status === "failed" && <p class="text-sm text-rose-600">カードデータを読み込めませんでした</p>}
    </main>
  );
}
