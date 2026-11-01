import { render } from "preact";
import { App } from "./app/App.tsx";
import { openIndexedDb } from "./app/idb.ts";
import { loadSkillCardData } from "./data/load.ts";
import "./index.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
const load = () => loadSkillCardData((url) => fetch(url));
// A browser with no IndexedDB for the page throws here or rejects; either way the page saves nothing and says so (src/app/storage.ts openSaved).
const openStore = () => openIndexedDb(indexedDB);
// navigator.storage is missing from a page over plain http, such as the dev server opened from a phone.
const storage: StorageManager | undefined = navigator.storage;
render(<App load={load} openStore={openStore} storage={storage} />, root);
