/**
 * The page's other tabs (#29): each tab keeps its memo in memory and saves the whole of it, so a tab
 * that never heard of another's write would later save its own older memo over it. After each write
 * a tab says so on this channel, and the others read the store again (src/app/storage.ts, `reread`).
 * The message carries nothing: what changed is read from the store, the one record.
 */

/** The slice of a BroadcastChannel the page needs; a test links two tabs with a stand-in. */
export interface TabChannel {
  /** Tells the page's other tabs that this one wrote the store. */
  post(): void;
  /** Calls `heard` whenever another tab posts; returns what stops listening. */
  listen(heard: () => void): () => void;
}

/** No other tab hears or is heard: a browser without BroadcastChannel, and tests of one tab. */
export const NO_TABS: TabChannel = { post: () => undefined, listen: () => () => undefined };

/** The channel all of the page's tabs share, named after the page. */
export const CHANNEL_NAME = "gkms-memomemo";

/**
 * The browser's BroadcastChannel as a TabChannel. A channel does not hear its own posts, so a tab
 * never rereads its own write. The I/O only, checked in a browser: happy-dom's channels are not used.
 */
export function broadcastTabs(make: (name: string) => BroadcastChannel): TabChannel {
  const channel = make(CHANNEL_NAME);
  return {
    post: () => channel.postMessage("saved"),
    listen: (heard) => {
      const onMessage = (): void => heard();
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
  };
}
