import { render } from "preact";
import { App } from "./app/App.tsx";
import { httpCounts } from "./app/counts.ts";
import { openIndexedDb } from "./app/idb.ts";
import { loadedUrls, startOffline } from "./app/offline.ts";
import { broadcastTabs, NO_TABS } from "./app/tabs.ts";
import { loadSkillCardData } from "./data/load.ts";
// The game's font, IBM Plex Sans JP, at the two weights the page uses (D67); each loads its slices as text needs them.
import "@fontsource/ibm-plex-sans-jp/500.css";
import "@fontsource/ibm-plex-sans-jp/700.css";
import "./index.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
const load = () => loadSkillCardData((url) => fetch(url));
// A browser with no IndexedDB for the page throws here or rejects; either way the page saves nothing and says so (src/app/storage.ts openSaved).
const openStore = () => openIndexedDb(indexedDB);
// navigator.storage is missing from a page over plain http, such as the dev server opened from a phone.
const storage: StorageManager | undefined = navigator.storage;
// Made once, so the page loads the counts once (src/app/MemoPage.tsx useCounts).
const countsApi = httpCounts((url, init) => fetch(url, init));
// The page's other open tabs (#29); a browser without BroadcastChannel still rereads the memo when the page is shown again.
const channel = typeof BroadcastChannel === "function" ? broadcastTabs((name) => new BroadcastChannel(name)) : NO_TABS;
render(<App load={load} openStore={openStore} storage={storage} countsApi={countsApi} channel={channel} />, root);
// The service worker is built only by `vite build`; the dev server has none to register.
if (import.meta.env.PROD) {
  const workers: ServiceWorkerContainer | undefined = navigator.serviceWorker;
  void startOffline(workers, loadedUrls);
}
