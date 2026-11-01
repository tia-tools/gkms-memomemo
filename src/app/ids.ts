/**
 * A new row's random id (docs/plans/EXECPLAN_MEMORY_MEMO.md § Interfaces and Dependencies): 12
 * random bytes as base64url, 16 characters of the row id's shape (src/memo/read.ts ID_SHAPES.row).
 * `crypto.getRandomValues` rather than `randomUUID`, which a page opened over plain http, such as
 * the dev server from a phone on the LAN, does not have.
 */

export const ROW_ID_BYTES = 12;

/** The bytes as base64url without padding. */
export function rowIdFrom(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function newRowId(): string {
  return rowIdFrom(crypto.getRandomValues(new Uint8Array(ROW_ID_BYTES)));
}
