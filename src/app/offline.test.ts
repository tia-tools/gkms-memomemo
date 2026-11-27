import { describe, expect, spyOn, test } from "bun:test";
import { startOffline, SW_URL, type Workers } from "./offline.ts";

const LOADED = ["https://gkms-library.tia.run/data/latest.v1.json", "https://gkms-memomemo.tia.run/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp"];

/** A `navigator.serviceWorker` that records what it is asked and sent; `takeOver` hands the page to a new worker, as a new version's claim does. */
function workers(controlled: boolean, registers = true): Workers & { registered: string[]; sent: unknown[]; toNew: unknown[]; takeOver: () => void } {
  const registered: string[] = [];
  const sent: unknown[] = [];
  const toNew: unknown[] = [];
  const listeners: (() => void)[] = [];
  const w: Workers & { registered: string[]; sent: unknown[]; toNew: unknown[]; takeOver: () => void } = {
    registered,
    sent,
    toNew,
    takeOver: () => {
      w.controller = { postMessage: (message) => toNew.push(message) };
      for (const listener of listeners) listener();
    },
    controller: controlled ? { postMessage: (message) => sent.push(message) } : null,
    addEventListener: (_type, listener) => void listeners.push(listener),
    register: (url) => {
      registered.push(url);
      return registers ? Promise.resolve({}) : Promise.reject(new Error("SecurityError"));
    },
    ready: Promise.resolve({ active: { postMessage: (message) => sent.push(message) } }),
  };
  return w;
}

describe("startOffline", () => {
  test("registers the worker at the root", async () => {
    const w = workers(true);
    await startOffline(w, () => LOADED);
    expect(w.registered).toEqual([SW_URL]);
    expect(SW_URL).toBe("/sw.js");
  });

  test("on a first visit, tells the worker what the page loaded before it took over", async () => {
    const w = workers(false);
    await startOffline(w, () => LOADED);
    expect(w.sent).toEqual([{ keep: LOADED }]);
  });

  test("a page the worker already controls sends nothing: the worker saw its requests", async () => {
    const w = workers(true);
    await startOffline(w, () => LOADED);
    expect(w.sent).toEqual([]);
  });

  test("a worker that takes over a page another worker controlled, such as a new version's, is told what the page loaded", async () => {
    const w = workers(true);
    await startOffline(w, () => LOADED);
    w.takeOver();
    expect([w.sent, w.toNew]).toEqual([[], [{ keep: LOADED }]]);
  });

  test("on a first visit, the claim that follows sends nothing more", async () => {
    const w = workers(false);
    await startOffline(w, () => LOADED);
    w.takeOver();
    expect([w.sent, w.toNew]).toEqual([[{ keep: LOADED }], []]);
  });

  test("a browser without service workers is left alone", async () => {
    expect(await startOffline(undefined, () => LOADED)).toBeUndefined();
  });

  test("a registration that fails is logged, and the page goes on", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const w = workers(false, false);
    await startOffline(w, () => LOADED);
    const said = String(logged.mock.calls[0]?.[0]);
    logged.mockRestore();
    expect([w.sent, said]).toEqual([[], "the page will not open offline:"]);
  });
});
