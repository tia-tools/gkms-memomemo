/** The 引き継ぎコード on the page in a simulated DOM (happy-dom): the code and the link out, a code read back in, by paste or by link (D16, D28, D59). */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { newBuild } from "../memo/build.ts";
import { decodeMemo, encodeMemo } from "../memo/code.ts";
import { addMemory, addRow, type Edited, isRefusal } from "../memo/edit.ts";
import { emptyMemo, type Memo, type Memory } from "../memo/types.ts";
import { byLabel, byText, CATALOG, must, section, settle, showPage, tap, type } from "../test-support/page.tsx";
import { cardNamed } from "../test-support/skillcards.ts";
import { HomeScreenHint } from "./Settings.tsx";
import { HOME_SCREEN_HINT } from "./install.ts";

const HIF = must(CATALOG.tabAbilities("sense")[0], "a センス ability").ability.id;
const DDR: Memory = ["diamond", "diamond", "rainbow"];

function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

function withRow(memo: Memo, id: string, name: string): Memo {
  const card = cardNamed(name);
  return ok(addRow(memo, "sense.kocho", id, newBuild(card.id, card, HIF)));
}

/** 成就+ in 好調 with one %%F memory. */
const JOJU = addMemory(withRow(emptyMemo(), "r1", "成就+"), "r1", "%%F", DDR);
/** ファンサ+ and 成就+ in 好調, no memories. */
const TWO = withRow(withRow(emptyMemo(), "f1", "ファンサ+"), "f2", "成就+");

let root: HTMLElement;
// A page's own address, not happy-dom's about:blank, whose history cannot be rewritten.
beforeAll(() => GlobalRegistrator.register({ url: "https://gkms-memomemo.tia.run/" }));
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(async () => {
  await act(() => render(null, root));
  history.replaceState(null, "", "/");
});

const rows = () => [...section(root, "好調").querySelectorAll("[data-row]")].map((el) => el.getAttribute("data-row"));
const transfer = () => must(root.querySelector<HTMLElement>('section[aria-label="引き継ぎコード"]'), "the 引き継ぎコード");
const confirmBox = () => must(root.querySelector<HTMLElement>('[role="alertdialog"]'), "the confirmation");
/**
 * How many confirmations `within` shows. Counted rather than compared as elements: a failing
 * comparison would print a happy-dom element, whose object graph the printer never finishes.
 */
const confirmations = (within: ParentNode = root) => within.querySelectorAll('[role="alertdialog"]').length;

async function pasteCode(code: string): Promise<void> {
  await tap(byText(transfer(), "button", "コードを読み込む"));
  await type(byLabel(transfer(), "読み込む引き継ぎコード"), code);
  await tap(byText(transfer(), "button", "読み込む"));
  await settle();
}

describe("the code out", () => {
  test("「コードを作る」 shows the memo's code, which reads back to the memo", async () => {
    await showPage(root, JOJU);
    await tap(byText(transfer(), "button", "コードを作る"));
    await settle();
    const code = must(byLabel(transfer(), "このメモの引き継ぎコード"), "the code");
    expect(code instanceof HTMLTextAreaElement && code.value.startsWith("mm1.")).toBe(true);
    expect(await decodeMemo(code instanceof HTMLTextAreaElement ? code.value : "")).toEqual(JOJU);
  });

  test("the code follows the memo while it is shown", async () => {
    await showPage(root, JOJU);
    await tap(byText(transfer(), "button", "コードを作る"));
    await settle();
    const before = byLabel(transfer(), "このメモの引き継ぎコード");
    const first = before instanceof HTMLTextAreaElement ? before.value : "";
    await tap(byLabel(section(root, "好調"), "%%F 3.5 / 3.5 / 20"));
    await tap(byText(root, "button", "削除"));
    await tap(byText(root, "button", "もう一度押すと削除"));
    await settle();
    const after = byLabel(transfer(), "このメモの引き継ぎコード");
    expect(after instanceof HTMLTextAreaElement ? after.value : first).not.toBe(first);
  });

  test("「コードをコピー」 copies the code and 「リンクをコピー」 the link carrying it in its fragment (D28)", async () => {
    const written: string[] = [];
    const clipboard = spyOn(navigator.clipboard, "writeText").mockImplementation((text: string) => {
      written.push(text);
      return Promise.resolve();
    });
    try {
      await showPage(root, JOJU);
      await tap(byText(transfer(), "button", "コードを作る"));
      await settle();
      await tap(byText(transfer(), "button", "コードをコピー"));
      await settle();
      expect(transfer().textContent).toContain("コードをコピーしました");
      await tap(byText(transfer(), "button", "リンクをコピー"));
      await settle();
      expect(transfer().textContent).toContain("リンクをコピーしました");
    } finally {
      clipboard.mockRestore();
    }
    const code = await encodeMemo(JOJU);
    expect(written).toEqual([code, `https://gkms-memomemo.tia.run/#import=${code}`]);
  });

  test("a clipboard that refuses says to copy from the box", async () => {
    const clipboard = spyOn(navigator.clipboard, "writeText").mockImplementation(() => Promise.reject(new Error("denied")));
    try {
      await showPage(root, JOJU);
      await tap(byText(transfer(), "button", "コードを作る"));
      await settle();
      await tap(byText(transfer(), "button", "コードをコピー"));
      await settle();
    } finally {
      clipboard.mockRestore();
    }
    expect(transfer().textContent).toContain("コピーできませんでした");
  });
});

describe("a pasted code", () => {
  test("into an empty memo is read in after a confirmation", async () => {
    await showPage(root);
    await pasteCode(await encodeMemo(JOJU));
    expect(confirmBox().textContent).toContain("コードのメモ（1行・メモリー1件）を読み込みます");
    // Answered beside the paste box, not at the top of the page where a link's is.
    expect([confirmations(), confirmations(transfer())]).toEqual([1, 1]);
    expect(rows()).toEqual([]);
    await tap(byText(confirmBox(), "button", "読み込む"));
    expect(rows()).toEqual(["r1"]);
  });

  test("replaces the memo, never merges, and 元に戻す brings back the one replaced", async () => {
    await showPage(root, TWO);
    await pasteCode(await encodeMemo(JOJU));
    expect(confirmBox().textContent).toContain("今のメモ（2行・メモリー0件）を、コードのメモ（1行・メモリー1件）に置き換えます");
    await tap(byText(confirmBox(), "button", "置き換える"));
    expect(rows()).toEqual(["r1"]);
    await tap(byText(transfer(), "button", "元に戻す"));
    expect(rows()).toEqual(["f1", "f2"]);
    expect(transfer().textContent).not.toContain("元に戻す");
  });

  test("「やめる」 leaves the memo as it was", async () => {
    await showPage(root, TWO);
    await pasteCode(await encodeMemo(JOJU));
    await tap(byText(confirmBox(), "button", "やめる"));
    expect([rows(), confirmations()]).toEqual([["f1", "f2"], 0]);
  });

  test("the undo is withdrawn by the next change, so it never throws a later edit away", async () => {
    await showPage(root, TWO);
    await pasteCode(await encodeMemo(JOJU));
    await tap(byText(confirmBox(), "button", "置き換える"));
    await tap(byLabel(section(root, "好調"), "%%F 3.5 / 3.5 / 20"));
    await tap(byText(root, "button", "削除"));
    await tap(byText(root, "button", "もう一度押すと削除"));
    expect(transfer().textContent).not.toContain("元に戻す");
    expect(rows()).toEqual(["r1"]);
  });

  test("a code given while another is still being read replaces it", async () => {
    await showPage(root, TWO);
    await tap(byText(transfer(), "button", "コードを読み込む"));
    await type(byLabel(transfer(), "読み込む引き継ぎコード"), await encodeMemo(JOJU));
    await tap(byText(transfer(), "button", "読み込む"));
    await type(byLabel(transfer(), "読み込む引き継ぎコード"), "abc");
    await tap(byText(transfer(), "button", "読み込む"));
    await settle();
    expect([confirmations(), transfer().querySelector('[role="alert"]')?.textContent]).toEqual([0, "引き継ぎコードではありません（mm1. で始まります）閉じる"]);
  });

  test("a later code withdraws a confirmation still shown at once, before it is read, so the earlier code cannot be accepted", async () => {
    await showPage(root, TWO);
    await pasteCode(await encodeMemo(JOJU));
    expect(confirmations()).toBe(1);
    await type(byLabel(transfer(), "読み込む引き継ぎコード"), await encodeMemo(TWO));
    await tap(byText(transfer(), "button", "読み込む"));
    expect(confirmations()).toBe(0);
    await settle();
    expect(confirmBox().textContent).toContain("コードのメモ（2行・メモリー0件）に置き換えます");
  });

  test("a code that is not one is refused, saying why, and the memo stays", async () => {
    await showPage(root, TWO);
    await pasteCode("abc");
    expect(must(transfer().querySelector('[role="alert"]'), "the refusal").textContent).toContain("引き継ぎコードではありません");
    expect(rows()).toEqual(["f1", "f2"]);
  });

  test("a cut code is refused as broken", async () => {
    await showPage(root, TWO);
    const code = await encodeMemo(JOJU);
    await pasteCode(code.slice(0, code.length - 8));
    expect(must(transfer().querySelector('[role="alert"]'), "the refusal").textContent).toContain("途中で切れているか、壊れています");
  });

  test("a code whose memo the reader refuses says so, and logs where", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...JOJU, formatVersion: 2 }));
    const compressed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const code = `mm1.${btoa(String.fromCharCode(...compressed)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      await showPage(root, TWO);
      await pasteCode(code);
      expect(String(logged.mock.calls[0]?.[1])).toContain("formatVersion");
    } finally {
      logged.mockRestore();
    }
    expect(must(transfer().querySelector('[role="alert"]'), "the refusal").textContent).toContain("このコードのメモは読み込めません");
  });
});

describe("a link's code (D28)", () => {
  test("is offered at the top of the page, and the fragment leaves the address bar at once", async () => {
    history.replaceState(null, "", `/#import=${await encodeMemo(JOJU)}`);
    await showPage(root, TWO);
    await settle();
    expect(location.hash).toBe("");
    const box = confirmBox();
    expect(box.compareDocumentPosition(must(root.querySelector('[role="tablist"]'), "the tabs")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await tap(byText(transfer(), "button", "コードを読み込む"));
    expect([confirmations(), confirmations(transfer())]).toEqual([1, 0]);
    await tap(byText(box, "button", "置き換える"));
    expect(rows()).toEqual(["r1"]);
  });

  test("is offered when the fragment changes while the page is open", async () => {
    await showPage(root, TWO);
    const code = await encodeMemo(JOJU);
    await act(() => {
      history.replaceState(null, "", `/#import=${code}`);
      window.dispatchEvent(new Event("hashchange"));
    });
    await settle();
    expect([location.hash, confirmBox().textContent?.includes("置き換えます")]).toEqual(["", true]);
  });

  test("an address with no #import= offers nothing and keeps its fragment", async () => {
    history.replaceState(null, "", "/#other");
    await showPage(root, TWO);
    await settle();
    expect([location.hash, confirmations()]).toEqual(["#other", 0]);
  });
});

describe("the home-screen hint (D61)", () => {
  test("is shown where it applies, and nowhere else", async () => {
    await act(() => render(<HomeScreenHint shown />, root));
    expect(root.textContent).toBe(HOME_SCREEN_HINT);
    await act(() => render(<HomeScreenHint shown={false} />, root));
    expect(root.textContent).toBe("");
  });

  test("is not shown in this test browser, which is no iPhone", async () => {
    await showPage(root);
    expect(root.textContent).not.toContain("ホーム画面に追加");
  });
});
