/**
 * The 引き継ぎコード's page side (docs/plans/EXECPLAN_MEMORY_MEMO.md, D16, D28 and D59): the link
 * that carries a code in its fragment, reading a code back out of one, and what the page says about a
 * code. The code itself is src/memo/code.ts.
 */

import type { CodeRefusal } from "../memo/code.ts";

/** A link's fragment starts so; the code follows it (D28: never the path or the query, which the server would see). */
export const IMPORT_FRAGMENT = "#import=";

/** The link that opens this page and offers to import `code`. */
export function importLink(page: { origin: string; pathname: string }, code: string): string {
  return `${page.origin}${page.pathname}${IMPORT_FRAGMENT}${code}`;
}

/**
 * The code a page address's fragment (`location.hash`) carries, or null when it carries none. A
 * code is base64url after `mm1.`, which needs no escaping, but an app that shares the link may
 * percent-encode it anyway; a malformed escape is left for the decoder to refuse.
 */
export function codeInFragment(hash: string): string | null {
  if (!hash.startsWith(IMPORT_FRAGMENT)) return null;
  const raw = hash.slice(IMPORT_FRAGMENT.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Why a code is not imported, as the page says it; for a memo the reader refuses, the console has the path. */
export function codeRefusalText(refusal: CodeRefusal): string {
  switch (refusal.refused) {
    case "prefix":
      return "引き継ぎコードではありません（mm1. で始まります）";
    case "encoding":
    case "compression":
    case "text":
      return "コードが途中で切れているか、壊れています";
    case "too-large":
      return "コードが大きすぎます";
    case "format":
      return "このコードのメモは読み込めません";
  }
}

export interface MemoSize {
  rows: number;
  memories: number;
}

function sizeText(size: MemoSize): string {
  return `${size.rows}行・メモリー${size.memories}件`;
}

/** The confirmation before an import replaces the memo (D16): what goes and what comes, so a wrong code is noticed. */
export function replaceText(current: MemoSize, incoming: MemoSize): string {
  if (current.rows === 0) return `コードのメモ（${sizeText(incoming)}）を読み込みます`;
  return `今のメモ（${sizeText(current)}）を、コードのメモ（${sizeText(incoming)}）に置き換えます`;
}
