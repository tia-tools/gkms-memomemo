/**
 * The 引き継ぎコード (docs/plans/EXECPLAN_MEMORY_MEMO.md, D16, D28, D31, D46): the memo as JSON,
 * compressed with the browser's `CompressionStream("deflate-raw")`, written in base64url and
 * prefixed `mm1.`. Decoding refuses a code with a reason rather than importing part of a memo: a
 * wrong prefix, characters outside base64url, a code or a memo past its size cap, a stream that does
 * not inflate, text that is not JSON, or a memo `readMemo` refuses (its message is the detail).
 */

import { MemoFormatError, readMemo } from "./read.ts";
import type { Memo } from "./types.ts";

export const CODE_PREFIX = "mm1.";
/** A code longer than this is refused unread; a memo of a few hundred rows is far below it (D46). */
export const MAX_CODE_LENGTH = 1_000_000;
/** The inflated memo's cap, so a small code cannot expand without bound (D46). */
export const MAX_MEMO_BYTES = 4_000_000;

export type CodeRefusal = {
  refused: "prefix" | "encoding" | "too-large" | "compression" | "text" | "format";
  /** For `format`, the path of the first bad value. */
  detail?: string;
};

export function isCodeRefusal(result: Memo | CodeRefusal): result is CodeRefusal {
  return "refused" in result;
}

/** base64url without padding, by `btoa`, which every browser the page targets has. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (text.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The inflated bytes, or why not: past `max` bytes, or not a deflate-raw stream. */
async function inflate(bytes: Uint8Array<ArrayBuffer>, max: number): Promise<Uint8Array | "too-large" | "compression"> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      total += next.value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return "too-large";
      }
      chunks.push(next.value);
    }
  } catch {
    return "compression";
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

export async function encodeMemo(memo: Memo): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(memo));
  const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return CODE_PREFIX + toBase64Url(new Uint8Array(await new Response(compressed).arrayBuffer()));
}

/** The memo a code carries, or why it is refused; surrounding white space is ignored. */
export async function decodeMemo(code: string): Promise<Memo | CodeRefusal> {
  // The cap counts the code as pasted, white space included, so no input is scanned past it.
  if (code.length > MAX_CODE_LENGTH) return { refused: "too-large" };
  const text = code.trim();
  if (!text.startsWith(CODE_PREFIX)) return { refused: "prefix" };
  const bytes = fromBase64Url(text.slice(CODE_PREFIX.length));
  if (bytes === null) return { refused: "encoding" };
  const inflated = await inflate(bytes, MAX_MEMO_BYTES);
  if (typeof inflated === "string") return { refused: inflated };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(inflated));
  } catch {
    return { refused: "text" };
  }
  try {
    return readMemo(json);
  } catch (error) {
    if (error instanceof MemoFormatError) return { refused: "format", detail: error.message };
    throw error;
  }
}
