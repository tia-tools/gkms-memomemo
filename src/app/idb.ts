/**
 * The store of src/app/storage.ts in the browser's IndexedDB (docs/plans/EXECPLAN_MEMORY_MEMO.md,
 * D16 and D57): the database `gkms-memomemo`, one object store `state`, each value under its name.
 * The I/O only: what is kept and when is storage.ts's, and is tested there. happy-dom has no
 * IndexedDB, so this file is checked in a browser.
 */

import type { Store } from "./storage.ts";

export const DB_NAME = "gkms-memomemo";
const OBJECTS = "state";
const VERSION = 1;

/** One request in its own transaction, settled when the transaction is, so a write has reached the disk. */
function inTransaction(db: IDBDatabase, mode: IDBTransactionMode, act: (objects: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OBJECTS, mode);
    const request = act(tx.objectStore(OBJECTS));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/** The page's store, or a rejection where the browser keeps no IndexedDB for it (a private window in some browsers). */
export function openIndexedDb(factory: IDBFactory): Promise<Store> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, VERSION);
    open.onupgradeneeded = () => open.result.createObjectStore(OBJECTS);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB did not open"));
    open.onsuccess = () => {
      const db = open.result;
      // A later version of the page opening the database first asks this one to let go.
      db.onversionchange = () => db.close();
      resolve({
        get: (key) => inTransaction(db, "readonly", (objects) => objects.get(key)),
        put: (key, value) => inTransaction(db, "readwrite", (objects) => objects.put(value, key)).then(() => undefined),
      });
    };
  });
}
