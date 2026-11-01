import { useEffect, useState } from "preact/hooks";
import { encodeMemo } from "../memo/code.ts";
import { memoSize } from "../memo/coverage.ts";
import { usePage } from "./page.ts";
import { importLink, replaceText } from "./transfer.ts";
import type { ImportFrom, Importing } from "./useImport.ts";

const BUTTON = "rounded border border-slate-300 bg-white px-3 py-1";

/**
 * What an import from `from` has come to (D16, D59): the refusal, the confirmation naming what goes
 * and what comes, or 元に戻す after the memo was replaced. A link's is shown at the top of the page,
 * a pasted code's beside the paste box.
 */
export function ImportPanel({ importing, from }: { importing: Importing; from: ImportFrom }) {
  const { memo } = usePage();
  const { state } = importing;
  if (state === null || state.from !== from) return null;
  const box = "flex flex-wrap items-center gap-2 rounded border p-2 text-sm";
  if (state.stage === "refused") {
    return (
      <div role="alert" class={`${box} border-rose-300 bg-rose-50 text-rose-700`}>
        <span class="flex-1">{state.text}</span>
        <button type="button" class={BUTTON} onClick={importing.dismiss}>
          閉じる
        </button>
      </div>
    );
  }
  if (state.stage === "confirm") {
    const current = memoSize(memo);
    return (
      <div role="alertdialog" aria-label="引き継ぎコードの読み込み" class={`${box} border-pink-300 bg-pink-50`}>
        <span class="flex-1">{replaceText(current, memoSize(state.memo))}</span>
        <button type="button" class="rounded bg-pink-600 px-3 py-1 font-bold text-white" onClick={importing.accept}>
          {current.rows === 0 ? "読み込む" : "置き換える"}
        </button>
        <button type="button" class={BUTTON} onClick={importing.dismiss}>
          やめる
        </button>
      </div>
    );
  }
  return (
    <div role="status" class={`${box} border-emerald-300 bg-emerald-50`}>
      <span class="flex-1">引き継ぎコードのメモを読み込みました</span>
      <button type="button" class={BUTTON} onClick={importing.undo}>
        元に戻す
      </button>
      <button type="button" class={BUTTON} onClick={importing.dismiss}>
        閉じる
      </button>
    </div>
  );
}

/** Copies to the clipboard, which a page over plain http (the dev server from a phone) does not have. */
function copyText(text: string): Promise<void> {
  const clipboard: Clipboard | undefined = navigator.clipboard;
  return clipboard === undefined ? Promise.reject(new Error("no clipboard")) : clipboard.writeText(text);
}

/** The memo's code, kept up to date while shown, with its copy buttons (D16, D28). */
function CodeOut() {
  const { memo } = usePage();
  const [code, setCode] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void encodeMemo(memo).then((c) => live && setCode(c));
    return () => {
      live = false;
    };
  }, [memo]);
  const copy = (text: string, what: string): void => {
    copyText(text).then(
      () => setSaid(`${what}をコピーしました`),
      () => setSaid("コピーできませんでした。欄の中を選んでコピーしてください"),
    );
  };
  return (
    <div class="flex flex-col gap-2">
      <textarea readOnly aria-label="このメモの引き継ぎコード" rows={3} class="w-full rounded border border-slate-300 p-1 font-mono text-xs break-all" value={code ?? ""} />
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class={BUTTON} disabled={code === null} onClick={() => code !== null && copy(code, "コード")}>
          コードをコピー
        </button>
        <button type="button" class={BUTTON} disabled={code === null} onClick={() => code !== null && copy(importLink(location, code), "リンク")}>
          リンクをコピー
        </button>
        {said !== null && <span role="status">{said}</span>}
      </div>
    </div>
  );
}

/** The paste box: a code typed or pasted in, offered for import. */
function CodeIn({ importing }: { importing: Importing }) {
  const [text, setText] = useState("");
  return (
    <div class="flex flex-col gap-2">
      <textarea
        aria-label="読み込む引き継ぎコード"
        rows={3}
        placeholder="mm1.…"
        class="w-full rounded border border-slate-300 p-1 font-mono text-xs break-all"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <div>
        <button type="button" class={BUTTON} disabled={text.trim() === ""} onClick={() => importing.offer(text, "paste")}>
          読み込む
        </button>
      </div>
      <ImportPanel importing={importing} from="paste" />
    </div>
  );
}

/**
 * The 引き継ぎコード (D16): the memo as a code and as a link, to move it to another device or keep a
 * copy, and a code read back in. Each part opens on demand: a code is long.
 */
export function Transfer({ importing }: { importing: Importing }) {
  const [open, setOpen] = useState<"out" | "in" | null>(null);
  const toggle = (part: "out" | "in") => setOpen(open === part ? null : part);
  return (
    <section aria-label="引き継ぎコード" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-bold">引き継ぎコード</span>
        <button type="button" class={BUTTON} aria-expanded={open === "out"} onClick={() => toggle("out")}>
          コードを作る
        </button>
        <button type="button" class={BUTTON} aria-expanded={open === "in"} onClick={() => toggle("in")}>
          コードを読み込む
        </button>
      </div>
      {open === "out" && <CodeOut />}
      {open === "in" && <CodeIn importing={importing} />}
    </section>
  );
}
